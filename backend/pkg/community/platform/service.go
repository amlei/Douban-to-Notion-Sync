package platform

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/conv"
	"github.com/lifeink-ai/backend/internal/config"
	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/internal/task"
	"github.com/lifeink-ai/backend/pkg/community/pagination"
	"github.com/lifeink-ai/backend/pkg/community/platform/douban"
	"github.com/lifeink-ai/backend/pkg/community/platform/flomo"
	"github.com/lifeink-ai/backend/pkg/community/platform/weread"
)

// ---------------------------------------------------------------------------
// Scraper client (HTTP + SSE)
// ---------------------------------------------------------------------------

// SSEEvent represents a Server-Sent Event from the Python scraper service.
type SSEEvent struct {
	Event string
	Data  string
}

// BindRequest is the request body for POST /bind.
type BindRequest struct {
	Platform string `json:"platform"`
	UserID   int64  `json:"user_id"`
	Channel  string `json:"channel"`
	APIKey   string `json:"api_key,omitempty"`
}

// SyncRequest is the request body for POST /sync.
type SyncRequest struct {
	Platform          string         `json:"platform"`
	UserID            int64          `json:"user_id"`
	SessionStateJSON  string         `json:"session_state_json"`
	CommunityUserID   string         `json:"community_user_id"`
	ExistingBookURLs  []string       `json:"existing_book_urls"`
	ExistingMovieURLs []string       `json:"existing_movie_urls"`
	BookmarkSynckeys  map[string]int `json:"bookmark_synckeys"`
}

// RefreshRequest is the request body for POST /refresh.
type RefreshRequest struct {
	Platform         string `json:"platform"`
	SessionStateJSON string `json:"session_state_json"`
}

// RefreshResponse is the response body for POST /refresh.
type RefreshResponse struct {
	CommunityUserID string `json:"community_user_id"`
	ProfileJSON     string `json:"profile_json"`
}

// UnbindRequest is the request body for POST /unbind.
type UnbindRequest struct {
	Platform         string `json:"platform"`
	SessionStateJSON string `json:"session_state_json"`
}

type ScraperClient struct {
	httpClient *http.Client
	baseURL    string
}

func NewScraperClient() *ScraperClient {
	baseURL := config.GetString("scraper_url")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:50051"
	}
	return &ScraperClient{
		httpClient: &http.Client{},
		baseURL:    baseURL,
	}
}

// CallBind starts a bind operation and returns a channel of SSE events.
func (c *ScraperClient) CallBind(ctx context.Context, req BindRequest) (<-chan SSEEvent, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/bind", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call bind: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("bind returned status %d", resp.StatusCode)
	}

	ch := make(chan SSEEvent, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		parseSSE(resp.Body, ch)
	}()
	return ch, nil
}

// CallSync starts a sync operation and returns a channel of SSE events.
func (c *ScraperClient) CallSync(ctx context.Context, req SyncRequest) (<-chan SSEEvent, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/sync", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call sync: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("sync returned status %d", resp.StatusCode)
	}

	ch := make(chan SSEEvent, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		parseSSE(resp.Body, ch)
	}()
	return ch, nil
}

// CallRefresh calls the refresh endpoint.
func (c *ScraperClient) CallRefresh(ctx context.Context, req RefreshRequest) (*RefreshResponse, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/refresh", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call refresh: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("refresh returned status %d", resp.StatusCode)
	}

	var result RefreshResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode refresh response: %w", err)
	}
	return &result, nil
}

// CallUnbind calls the unbind endpoint to logout from the platform.
func (c *ScraperClient) CallUnbind(ctx context.Context, req UnbindRequest) error {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/unbind", bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("call unbind: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unbind returned status %d", resp.StatusCode)
	}
	return nil
}

// HealthCheck calls the health endpoint.
func (c *ScraperClient) HealthCheck(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: %d", resp.StatusCode)
	}
	return nil
}

func parseSSE(reader io.Reader, ch chan<- SSEEvent) {
	scanner := bufio.NewScanner(reader)
	var event string
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 {
			continue
		}
		if line[0] == ':' {
			continue
		}
		colon := -1
		for i, c := range line {
			if c == ':' {
				colon = i
				break
			}
		}
		field := line
		value := ""
		if colon >= 0 {
			field = line[:colon]
			if colon+1 < len(line) && line[colon+1] == ' ' {
				value = line[colon+2:]
			} else if colon+1 < len(line) {
				value = line[colon+1:]
			}
		}

		switch field {
		case "event":
			event = value
		case "data":
			ch <- SSEEvent{Event: event, Data: value}
		}
	}
}

// ---------------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------------

// BindData holds community-specific task payload data.
type BindData struct {
	QRBase64     string
	UserID       string
	Profile      any
	Error        string
	ScrapePhase  string
	ScrapeCounts map[string]int64
}

// BindTask and TaskManager are type aliases over the generic task package.
type BindTask = task.Entry[BindData]
type TaskManager = task.Manager[BindData]

// ---------------------------------------------------------------------------
// Community service
// ---------------------------------------------------------------------------

type CommunityService struct {
	client     *ent.Client
	db         *sql.DB
	taskMgr    *TaskManager
	scraper    *ScraperClient
	metaRepo   *CommunityMetaRepo
	dataRepo   *DataRepo
	doubanRepo *douban.DoubanRepo
	wereadRepo *weread.WereadRepo
	flomoRepo  *flomo.FlomoRepo
}

func NewCommunityService(client *ent.Client, db *sql.DB, taskMgr *TaskManager) *CommunityService {
	return &CommunityService{
		client:     client,
		db:         db,
		taskMgr:    taskMgr,
		scraper:    NewScraperClient(),
		metaRepo:   NewCommunityMetaRepo(client),
		dataRepo:   NewDataRepo(client, db),
		doubanRepo: douban.NewDoubanRepo(client, db),
		wereadRepo: weread.NewWereadRepo(client, db),
		flomoRepo:  flomo.NewFlomoRepo(client, db),
	}
}

func (s *CommunityService) Status(ctx context.Context, userID int64, platform string) (map[string]any, error) {
	t := s.taskMgr.Get(userID, platform)
	if t != nil && t.Status != "idle" {
		result := map[string]any{"status": t.Status}
		if t.Data.QRBase64 != "" {
			result["qr_base64"] = t.Data.QRBase64
		}
		if t.Status == "scraping" {
			result["scrape_phase"] = t.Data.ScrapePhase
			result["scrape_counts"] = t.Data.ScrapeCounts
		}
		if t.Status == "bound" {
			result["user_id"] = t.Data.UserID
			result["profile"] = t.Data.Profile
			result["scrape_counts"] = t.Data.ScrapeCounts
		}
		if t.Status == "failed" {
			result["error"] = t.Data.Error
		}
		return result, nil
	}

	platformID := PlatformNameToID(platform)
	if platformID == 0 {
		return map[string]any{"status": "idle"}, nil
	}

	row, err := s.metaRepo.GetBinding(ctx, userID, platformID)
	if err == nil && row != nil && row.Bound == 1 {
		result := conv.CommunityMetaToAPIDict(row)
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

func (s *CommunityService) StartBind(ctx context.Context, userID int64, platform, channel, apiKey string) (string, error) {
	t := s.taskMgr.Create(userID, platform, BindData{ScrapeCounts: make(map[string]int64)})
	go s.runBind(userID, platform, channel, apiKey, t)
	return t.ID, nil
}

func (s *CommunityService) runBind(userID int64, platform, channel, apiKey string, t *BindTask) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// WeRead API Key path: Go direct, skip Python scraper.
	if platform == "weread" && apiKey != "" {
		s.runBindWereadAPI(ctx, userID, apiKey, t)
		return
	}

	events, err := s.scraper.CallBind(ctx, BindRequest{
		Platform: platform,
		UserID:   userID,
		Channel:  channel,
	})
	if err != nil {
		t.Status = "failed"
		t.Data.Error = err.Error()
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
				t.Data.QRBase64 = qr
			}
			if phase, ok := payload["phase"].(string); ok {
				t.Data.ScrapePhase = phase
			}
			t.Notify()

		case "bound":
			t.Status = "bound"
			if uid, ok := payload["community_user_id"].(string); ok {
				t.Data.UserID = uid
			}
			if profileJSON, ok := payload["profile_json"].(string); ok {
				var profile any
				json.Unmarshal([]byte(profileJSON), &profile)
				t.Data.Profile = profile
			}
			if stateJSON, ok := payload["session_state_json"].(string); ok {
				expiresAt := ""
				if v, ok := payload["session_expires_at"].(string); ok {
					expiresAt = v
				}
				platformID := PlatformNameToID(platform)
				s.metaRepo.SaveBinding(ctx, userID, platformID, t.Data.UserID, t.Data.Profile)
				s.metaRepo.SaveSessionState(ctx, userID, platformID, stateJSON, &expiresAt)
			}
			t.Notify()

		case "scraping":
			t.Status = "scraping"
			if phase, ok := payload["phase"].(string); ok {
				t.Data.ScrapePhase = phase
			}
			if counts, ok := payload["counts"].(map[string]any); ok {
				for k, v := range counts {
					if n, ok := v.(float64); ok {
						t.Data.ScrapeCounts[k] = int64(n)
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
						t.Data.ScrapeCounts[k] = int64(n)
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
				t.Data.Error = errMsg
			} else {
				t.Data.Error = evt.Data
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

	t := s.taskMgr.Create(userID, platform, BindData{ScrapeCounts: make(map[string]int64)})
	t.Status = "scraping"
	communityUserID := *row.CommunityUserID

	go s.runSync(userID, platform, communityUserID, sessionState, t)
	return t.ID, nil
}

func (s *CommunityService) runSync(userID int64, platform, communityUserID, sessionState string, t *BindTask) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Check if this is an API Key authenticated weread binding.
	if platform == "weread" && isAPIKeyAuth(sessionState) {
		log.Printf("[weread-api] runSync: routing to API Key path")
		s.runSyncWereadAPI(ctx, userID, sessionState, t)
		return
	}

	ssPreview := sessionState
	if len(ssPreview) > 80 {
		ssPreview = ssPreview[:80]
	}
	log.Printf("[community] runSync: platform=%s, apiKeyAuth=%v, sessionState=%s", platform, isAPIKeyAuth(sessionState), ssPreview)

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

	events, err := s.scraper.CallSync(ctx, SyncRequest{
		Platform:          platform,
		UserID:            userID,
		SessionStateJSON:  sessionState,
		CommunityUserID:   communityUserID,
		ExistingBookURLs:  existingBookURLs,
		ExistingMovieURLs: existingMovieURLs,
		BookmarkSynckeys:  bookmarkSynckeys,
	})
	if err != nil {
		t.Status = "failed"
		t.Data.Error = err.Error()
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
				t.Data.ScrapePhase = phase
			}
			t.Notify()

		case "data":
			s.handleDataEvent(ctx, userID, platform, payload)

		case "done":
			t.Status = "bound"
			if counts, ok := payload["counts"].(map[string]any); ok {
				for k, v := range counts {
					if n, ok := v.(float64); ok {
						t.Data.ScrapeCounts[k] = int64(n)
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
				t.Data.Error = errMsg
			} else {
				t.Data.Error = evt.Data
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

	// API Key path for weread: validate key and return profile.
	if platform == "weread" && isAPIKeyAuth(sessionState) {
		apiKey := extractAPIKey(sessionState)
		client := weread.NewSkillAPIClient(apiKey)
		if err := client.ValidateKey(ctx); err != nil {
			return nil, fmt.Errorf("API Key 验证失败: %w", err)
		}
		shelf, err := client.FetchShelf(ctx)
		if err != nil {
			return nil, fmt.Errorf("获取书架失败: %w", err)
		}
		communityUserID := row.CommunityUserID
		if communityUserID == nil {
			uid := wereadDeriveUserID(shelf)
			communityUserID = &uid
		}
		profile := wereadBuildProfile(shelf)
		s.metaRepo.SaveBinding(ctx, userID, platformID, *communityUserID, profile)
		return map[string]any{
			"bound":    true,
			"platform": platform,
			"user_id":  *communityUserID,
			"profile":  profile,
		}, nil
	}

	resp, err := s.scraper.CallRefresh(ctx, RefreshRequest{
		Platform:         platform,
		SessionStateJSON: sessionState,
	})
	if err != nil {
		return nil, err
	}

	var profile any
	json.Unmarshal([]byte(resp.ProfileJSON), &profile)
	s.metaRepo.SaveBinding(ctx, userID, platformID, resp.CommunityUserID, profile)

	return map[string]any{
		"bound":    true,
		"platform": platform,
		"user_id":  resp.CommunityUserID,
		"profile":  profile,
	}, nil
}

func (s *CommunityService) Unbind(ctx context.Context, userID int64, platform string) error {
	if platform == "flomo" {
		platformID := PlatformNameToID(platform)
		if row, err := s.metaRepo.GetBinding(ctx, userID, platformID); err == nil && row != nil && row.SessionStateJSON != nil {
			if state := *row.SessionStateJSON; state != "" {
				go s.scraper.CallUnbind(context.Background(), UnbindRequest{
					Platform:         platform,
					SessionStateJSON: state,
				})
			}
		}
	}

	platformID := PlatformNameToID(platform)
	err := s.metaRepo.DeleteBinding(ctx, userID, platformID)
	s.taskMgr.ClearKey(userID, platform)
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
		t.Data.ScrapeCounts["memos"] = int64(len(memos))
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
	for _, b := range allBooks {
		if b.PlatformID == PlatformDouban {
			doubanBooks = append(doubanBooks, conv.BookToAPIDict(b))
		} else if b.PlatformID == PlatformWeread {
			wereadBooks = append(wereadBooks, conv.BookToAPIDict(b))
		}
	}

	movieList := []map[string]any{}
	for _, m := range movies {
		movieList = append(movieList, douban.MovieToAPIDict(m))
	}
	noteList := []map[string]any{}
	for _, n := range notes {
		noteList = append(noteList, weread.NoteToAPIDict(n))
	}
	bookmarkList := []map[string]any{}
	for _, b := range bookmarks {
		bookmarkList = append(bookmarkList, weread.BookmarkToAPIDict(b))
	}
	memoList := []map[string]any{}
	for _, m := range memos {
		memoList = append(memoList, flomo.FlomoMemoToAPIDict(m))
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

// GetPaginatedData dispatches to the appropriate repo for paginated queries.
func (s *CommunityService) GetPaginatedData(
	ctx context.Context,
	userID int64,
	dataType string,
	req pagination.PaginationRequest,
	bookFilter pagination.BookFilter,
) (*pagination.PaginatedResponse, error) {
	switch dataType {
	case "books":
		return s.dataRepo.GetPaginatedBooks(ctx, userID, req, bookFilter)
	case "movies":
		return s.doubanRepo.GetPaginatedMovies(ctx, userID, req)
	case "notes":
		return s.wereadRepo.GetPaginatedNotes(ctx, userID, req)
	case "bookmarks":
		return s.wereadRepo.GetPaginatedBookmarks(ctx, userID, req)
	case "memos":
		return s.flomoRepo.GetPaginatedMemos(ctx, userID, req)
	default:
		return nil, fmt.Errorf("unsupported data type: %s", dataType)
	}
}

func (s *CommunityService) GetClient() *ent.Client {
	return database.Client
}

// ---------------------------------------------------------------------------
// WeRead Skill API direct paths
// ---------------------------------------------------------------------------

func isAPIKeyAuth(sessionState string) bool {
	var data struct {
		AuthMethod string `json:"auth_method"`
	}
	json.Unmarshal([]byte(sessionState), &data)
	return data.AuthMethod == "api_key"
}

func extractAPIKey(sessionState string) string {
	var data struct {
		APIKey string `json:"api_key"`
	}
	json.Unmarshal([]byte(sessionState), &data)
	return data.APIKey
}

// wereadDeriveUserID and wereadBuildProfile are wrappers that call the
// unexported helpers from the weread sub-package via exported functions
// that mirror the logic. This avoids an import cycle.
func wereadDeriveUserID(shelf *weread.ShelfResponse) string {
	if len(shelf.Books) > 0 {
		return fmt.Sprintf("weread_api_%d", shelf.Books[0].ReadUpdateTime)
	}
	return "weread_api_unknown"
}

func wereadBuildProfile(shelf *weread.ShelfResponse) map[string]any {
	return map[string]any{
		"user_id":  wereadDeriveUserID(shelf),
		"name":     "微信读书用户",
		"avatar":   nil,
		"books":    len(shelf.Books),
		"platform": "weread",
	}
}

func (s *CommunityService) runBindWereadAPI(ctx context.Context, userID int64, apiKey string, t *BindTask) {
	log.Printf("[weread-api] runBindWereadAPI started, userID=%d, apiKey=%s…", userID, apiKey[:8])
	client := weread.NewSkillAPIClient(apiKey)

	// 1. Validate API Key.
	t.Status = "validating"
	t.Notify()
	log.Printf("[weread-api] validating API key…")
	if err := client.ValidateKey(ctx); err != nil {
		t.Status = "failed"
		t.Data.Error = fmt.Errorf("API Key 验证失败: %w", err).Error()
		t.Notify()
		log.Printf("[weread-api] validate failed: %v", err)
		return
	}
	log.Printf("[weread-api] API key valid")

	// 2. Fetch shelf to get profile.
	t.Status = "fetching_profile"
	t.Data.ScrapePhase = "fetching_profile"
	t.Notify()
	log.Printf("[weread-api] fetching shelf…")
	shelf, err := client.FetchShelf(ctx)
	if err != nil {
		t.Status = "failed"
		t.Data.Error = fmt.Errorf("获取书架失败: %w", err).Error()
		t.Notify()
		log.Printf("[weread-api] fetch shelf failed: %v", err)
		return
	}
	log.Printf("[weread-api] fetched shelf: %d books", len(shelf.Books))

	// 3. Save binding + API Key immediately once validated.
	communityUserID := wereadDeriveUserID(shelf)
	profile := wereadBuildProfile(shelf)

	stateJSON, _ := json.Marshal(map[string]string{
		"auth_method": "api_key",
		"api_key":     apiKey,
	})
	s.metaRepo.SaveBinding(ctx, userID, PlatformWeread, communityUserID, profile)
	s.metaRepo.SaveSessionState(ctx, userID, PlatformWeread, string(stateJSON), nil)
	log.Printf("[weread-api] binding saved, userID=%s", communityUserID)

	t.Data.UserID = communityUserID
	t.Data.Profile = profile
	// Mark as bound immediately so frontend dismisses the overlay.
	t.Status = "bound"
	t.Notify()

	// 4. Sync data in the background (books, bookmarks, reviews).
	onProgress := func(phase string, current, total int) {
		t.Data.ScrapePhase = phase
		t.Notify()
	}

	log.Printf("[weread-api] starting SyncWithAPI (background)…")
	result, err := weread.SyncWithAPI(ctx, client, s.dataRepo, s.wereadRepo, s.wereadRepo, userID, onProgress)
	if err != nil {
		log.Printf("[weread-api] sync failed: %v", err)
		return
	}

	log.Printf("[weread-api] sync done: books=%d, bookmarks=%d, notes=%d", result.Books, result.Bookmarks, result.Notes)
	t.Data.ScrapeCounts = map[string]int64{
		"books":     int64(result.Books),
		"bookmarks": int64(result.Bookmarks),
		"notes":     int64(result.Notes),
	}
	t.Notify()
}

func (s *CommunityService) runSyncWereadAPI(ctx context.Context, userID int64, sessionState string, t *BindTask) {
	apiKey := extractAPIKey(sessionState)
	log.Printf("[weread-api] runSyncWereadAPI started, apiKey=%s", func() string {
		if apiKey != "" {
			return apiKey[:8] + "…"
		}
		return "(empty)"
	}())
	client := weread.NewSkillAPIClient(apiKey)

	onProgress := func(phase string, current, total int) {
		t.Status = "scraping"
		t.Data.ScrapePhase = phase
		t.Notify()
	}

	log.Printf("[weread-api] starting SyncWithAPI…")
	result, err := weread.SyncWithAPI(ctx, client, s.dataRepo, s.wereadRepo, s.wereadRepo, userID, onProgress)
	if err != nil {
		t.Status = "failed"
		t.Data.Error = err.Error()
		t.Notify()
		log.Printf("[weread-api] sync failed: %v", err)
		return
	}

	t.Status = "bound"
	t.Data.ScrapeCounts = map[string]int64{
		"books":     int64(result.Books),
		"bookmarks": int64(result.Bookmarks),
		"notes":     int64(result.Notes),
	}
	t.Notify()
	log.Printf("[weread-api] sync done: books=%d, bookmarks=%d, notes=%d", result.Books, result.Bookmarks, result.Notes)
}
