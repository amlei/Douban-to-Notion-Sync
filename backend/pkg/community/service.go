package community

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/uptrace/bun"

	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/pkg/community/douban"
	"github.com/lifeink-ai/backend/pkg/community/flomo"
	"github.com/lifeink-ai/backend/pkg/community/weread"
	"github.com/lifeink-ai/backend/pkg/scraper"
)

type CommunityService struct {
	db          *bun.DB
	taskMgr     *TaskManager
	scraper     *scraper.Client
	metaRepo    *CommunityMetaRepo
	dataRepo    *DataRepo
	doubanRepo  *douban.DoubanRepo
	wereadRepo  *weread.WereadRepo
	flomoRepo   *flomo.FlomoRepo
}

func NewCommunityService(db *bun.DB, taskMgr *TaskManager, scraperClient *scraper.Client) *CommunityService {
	return &CommunityService{
		db:         db,
		taskMgr:    taskMgr,
		scraper:    scraperClient,
		metaRepo:   NewCommunityMetaRepo(db),
		dataRepo:   NewDataRepo(db),
		doubanRepo: douban.NewDoubanRepo(db),
		wereadRepo: weread.NewWereadRepo(db),
		flomoRepo:  flomo.NewFlomoRepo(db),
	}
}

func (s *CommunityService) Status(ctx context.Context, userID int64, platform string) (map[string]any, error) {
	t := s.taskMgr.GetTask(userID, platform)
	if t != nil && t.Status != "idle" {
		result := map[string]any{"status": t.Status}
		if t.QRBase64 != "" {
			result["qr_base64"] = t.QRBase64
		}
		if t.Status == "scraping" {
			result["scrape_phase"] = t.ScrapePhase
			result["scrape_counts"] = t.ScrapeCounts
		}
		if t.Status == "bound" {
			result["user_id"] = t.UserID
			result["profile"] = t.Profile
			result["scrape_counts"] = t.ScrapeCounts
		}
		if t.Status == "failed" {
			result["error"] = t.Error
		}
		return result, nil
	}

	platformID := PlatformNameToID(platform)
	if platformID == 0 {
		return map[string]any{"status": "idle"}, nil
	}

	row, err := s.metaRepo.GetBinding(ctx, userID, platformID)
	if err == nil && row != nil && row.Bound == 1 {
		result := row.ToAPIDict()
		result["status"] = "bound"
		return result, nil
	}
	return map[string]any{"status": "idle"}, nil
}

func (s *CommunityService) StatusAll(ctx context.Context, userID int64) (map[string]map[string]any, error) {
	result := map[string]map[string]any{}
	for _, pf := range SupportedPlatforms() {
		status, _ := s.Status(ctx, userID, pf)
		result[pf] = status
	}
	return result, nil
}

func (s *CommunityService) StartBind(ctx context.Context, userID int64, platform, channel string) (string, error) {
	t := s.taskMgr.CreateTask(userID, platform)
	go s.runBind(userID, platform, channel, t)
	return t.TaskID, nil
}

func (s *CommunityService) runBind(userID int64, platform, channel string, t *BindTask) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	events, err := s.scraper.CallBind(ctx, scraper.BindRequest{
		Platform: platform,
		UserID:   userID,
		Channel:  channel,
	})
	if err != nil {
		t.Status = "failed"
		t.Error = err.Error()
		t.Notify()
		return
	}

	for evt := range events {
		var payload map[string]any
		json.Unmarshal([]byte(evt.Data), &payload)

		switch evt.Event {
		case "progress":
			if status, ok := payload["status"].(string); ok {
				t.Status = status
			}
			if qr, ok := payload["qr_base64"].(string); ok {
				t.QRBase64 = qr
			}
			if phase, ok := payload["phase"].(string); ok {
				t.ScrapePhase = phase
			}
			t.Notify()

		case "bound":
			t.Status = "bound"
			if uid, ok := payload["community_user_id"].(string); ok {
				t.UserID = uid
			}
			if profileJSON, ok := payload["profile_json"].(string); ok {
				var profile any
				json.Unmarshal([]byte(profileJSON), &profile)
				t.Profile = profile
			}
			if stateJSON, ok := payload["session_state_json"].(string); ok {
				expiresAt := ""
				if v, ok := payload["session_expires_at"].(string); ok {
					expiresAt = v
				}
				platformID := PlatformNameToID(platform)
				s.metaRepo.SaveBinding(ctx, userID, platformID, t.UserID, t.Profile)
				s.metaRepo.SaveSessionState(ctx, userID, platformID, stateJSON, &expiresAt)
			}
			t.Notify()

		case "scraping":
			t.Status = "scraping"
			if phase, ok := payload["phase"].(string); ok {
				t.ScrapePhase = phase
			}
			if counts, ok := payload["counts"].(map[string]any); ok {
				for k, v := range counts {
					if n, ok := v.(float64); ok {
						t.ScrapeCounts[k] = int64(n)
					}
				}
			}
			t.Notify()

		case "data":
			s.handleDataEvent(ctx, userID, platform, payload)

		case "done":
			t.Status = "bound"
			if counts, ok := payload["counts"].(map[string]any); ok {
				for k, v := range counts {
					if n, ok := v.(float64); ok {
						t.ScrapeCounts[k] = int64(n)
					}
				}
			}
			if zipPath, ok := payload["zip_path"].(string); ok && zipPath != "" {
				s.processFlomoZip(ctx, userID, zipPath, t)
			}
			t.Notify()
			return

		case "error":
			t.Status = "failed"
			if errMsg, ok := payload["error"].(string); ok {
				t.Error = errMsg
			} else {
				t.Error = evt.Data
			}
			t.Notify()
			return
		}
	}
}

func (s *CommunityService) StartSync(ctx context.Context, userID int64, platform string) (string, error) {
	platformID := PlatformNameToID(platform)
	row, err := s.metaRepo.GetBinding(ctx, userID, platformID)
	if err != nil || row == nil || row.Bound != 1 || row.CommunityUserID == nil {
		return "", fmt.Errorf("not bound")
	}

	sessionState := ""
	if row.SessionStateJSON != nil {
		sessionState = *row.SessionStateJSON
	}

	t := s.taskMgr.CreateTask(userID, platform)
	t.Status = "scraping"
	communityUserID := *row.CommunityUserID

	go s.runSync(userID, platform, communityUserID, sessionState, t)
	return t.TaskID, nil
}

func (s *CommunityService) runSync(userID int64, platform, communityUserID, sessionState string, t *BindTask) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	existingBookURLs := []string{}
	existingMovieURLs := []string{}
	bookmarkSynckeys := map[string]int{}

	if platform == "douban" {
		books, _ := s.dataRepo.GetBooks(ctx, userID)
		for _, b := range books {
			existingBookURLs = append(existingBookURLs, b.URL)
		}
		movies, _ := s.doubanRepo.GetMovies(ctx, userID)
		for _, m := range movies {
			existingMovieURLs = append(existingMovieURLs, m.URL)
		}
	} else if platform == "weread" {
		synckeys, _ := s.dataRepo.GetBookmarkSynckeys(ctx, userID)
		bookmarkSynckeys = synckeys
	}

	events, err := s.scraper.CallSync(ctx, scraper.SyncRequest{
		Platform:         platform,
		UserID:           userID,
		SessionStateJSON: sessionState,
		CommunityUserID:  communityUserID,
		ExistingBookURLs: existingBookURLs,
		ExistingMovieURLs: existingMovieURLs,
		BookmarkSynckeys: bookmarkSynckeys,
	})
	if err != nil {
		t.Status = "failed"
		t.Error = err.Error()
		t.Notify()
		return
	}

	for evt := range events {
		var payload map[string]any
		json.Unmarshal([]byte(evt.Data), &payload)

		switch evt.Event {
		case "progress":
			if status, ok := payload["status"].(string); ok {
				t.Status = status
			}
			if phase, ok := payload["phase"].(string); ok {
				t.ScrapePhase = phase
			}
			t.Notify()

		case "data":
			s.handleDataEvent(ctx, userID, platform, payload)

		case "done":
			t.Status = "bound"
			if counts, ok := payload["counts"].(map[string]any); ok {
				for k, v := range counts {
					if n, ok := v.(float64); ok {
						t.ScrapeCounts[k] = int64(n)
					}
				}
			}
			if zipPath, ok := payload["zip_path"].(string); ok && zipPath != "" {
				s.processFlomoZip(ctx, userID, zipPath, t)
			}
			t.Notify()
			return

		case "error":
			t.Status = "failed"
			if errMsg, ok := payload["error"].(string); ok {
				t.Error = errMsg
			} else {
				t.Error = evt.Data
			}
			t.Notify()
			return
		}
	}
}

func (s *CommunityService) handleDataEvent(ctx context.Context, userID int64, platform string, payload map[string]any) {
	dataType, ok := payload["type"].(string)
	if !ok {
		return
	}
	itemsRaw, ok := payload["items"].([]any)
	if !ok || len(itemsRaw) == 0 {
		return
	}

	items := make([]map[string]any, len(itemsRaw))
	for i, item := range itemsRaw {
		if m, ok := item.(map[string]any); ok {
			items[i] = m
		}
	}

	switch dataType {
	case "book":
		if platform == "weread" {
			s.dataRepo.UpsertWereadBooks(ctx, userID, items)
		} else {
			s.dataRepo.UpsertBooks(ctx, userID, items)
		}
	case "movie":
		s.doubanRepo.UpsertMovies(ctx, userID, items)
	case "game":
		s.doubanRepo.UpsertGames(ctx, userID, items)
	case "review":
		s.doubanRepo.UpsertReviews(ctx, userID, items)
	case "note":
		s.wereadRepo.UpsertNotes(ctx, userID, items)
	case "bookmark":
		s.wereadRepo.UpsertBookmarks(ctx, userID, items)
	case "memo":
		s.flomoRepo.UpsertFlomoMemos(ctx, userID, items)
	default:
		log.Printf("[community] Unknown data type: %s", dataType)
	}
}

func (s *CommunityService) Refresh(ctx context.Context, userID int64, platform string) (map[string]any, error) {
	platformID := PlatformNameToID(platform)
	row, err := s.metaRepo.GetBinding(ctx, userID, platformID)
	if err != nil || row == nil || row.Bound != 1 {
		return nil, fmt.Errorf("not bound")
	}

	sessionState := ""
	if row.SessionStateJSON != nil {
		sessionState = *row.SessionStateJSON
	}

	resp, err := s.scraper.CallRefresh(ctx, scraper.RefreshRequest{
		Platform:          platform,
		SessionStateJSON:  sessionState,
	})
	if err != nil {
		return nil, err
	}

	var profile any
	json.Unmarshal([]byte(resp.ProfileJSON), &profile)
	s.metaRepo.SaveBinding(ctx, userID, platformID, resp.CommunityUserID, profile)

	return map[string]any{
		"bound":      true,
		"platform":   platform,
		"user_id":    resp.CommunityUserID,
		"profile":    profile,
	}, nil
}

func (s *CommunityService) Unbind(ctx context.Context, userID int64, platform string) error {
	if platform == "flomo" {
		platformID := PlatformNameToID(platform)
		if row, err := s.metaRepo.GetBinding(ctx, userID, platformID); err == nil && row != nil && row.SessionStateJSON != nil {
			if state := *row.SessionStateJSON; state != "" {
				go s.scraper.CallUnbind(context.Background(), scraper.UnbindRequest{
					Platform:         platform,
					SessionStateJSON: state,
				})
			}
		}
	}

	platformID := PlatformNameToID(platform)
	err := s.metaRepo.DeleteBinding(ctx, userID, platformID)
	s.taskMgr.ClearPlatformTask(userID, platform)
	return err
}

func (s *CommunityService) processFlomoZip(ctx context.Context, userID int64, zipPath string, t *BindTask) {
	memos, err := flomo.ParseFlomoExport(zipPath)
	if err != nil {
		log.Printf("[community] Failed to parse flomo zip %s: %v", zipPath, err)
		return
	}
	if len(memos) > 0 {
		s.flomoRepo.UpsertFlomoMemos(ctx, userID, memos)
		t.ScrapeCounts["memos"] = int64(len(memos))
	}
	os.Remove(zipPath)
}

func (s *CommunityService) GetCommunityData(ctx context.Context, userID int64) (map[string]any, error) {
	allBooks, _ := s.dataRepo.GetBooks(ctx, userID)
	movies, _ := s.doubanRepo.GetMovies(ctx, userID)
	notes, _ := s.wereadRepo.GetNotes(ctx, userID)
	bookmarks, _ := s.wereadRepo.GetBookmarks(ctx, userID)
	memos, _ := s.flomoRepo.GetFlomoMemos(ctx, userID)

	doubanBooks := []map[string]any{}
	wereadBooks := []map[string]any{}
	for i := range allBooks {
		if allBooks[i].PlatformID == PlatformDouban {
			doubanBooks = append(doubanBooks, allBooks[i].ToAPIDict())
		} else if allBooks[i].PlatformID == PlatformWeread {
			wereadBooks = append(wereadBooks, allBooks[i].ToAPIDict())
		}
	}

	movieList := []map[string]any{}
	for i := range movies {
		movieList = append(movieList, movies[i].ToAPIDict())
	}
	noteList := []map[string]any{}
	for i := range notes {
		noteList = append(noteList, notes[i].ToAPIDict())
	}
	bookmarkList := []map[string]any{}
	for i := range bookmarks {
		bookmarkList = append(bookmarkList, bookmarks[i].ToAPIDict())
	}
	memoList := []map[string]any{}
	for i := range memos {
		memoList = append(memoList, memos[i].ToAPIDict())
	}

	return map[string]any{
		"douban": map[string]any{
			"books":  doubanBooks,
			"movies": movieList,
			"notes":  noteList,
		},
		"weread": map[string]any{
			"books":     wereadBooks,
			"bookmarks": bookmarkList,
		},
		"flomo": map[string]any{
			"memos": memoList,
		},
	}, nil
}

func (s *CommunityService) GetDB() *bun.DB {
	return database.DB
}
