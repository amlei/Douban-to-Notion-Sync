package weread

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// ProgressFunc is a callback to report sync progress.
type ProgressFunc func(phase string, current, total int)

// SyncResult holds counts from a sync operation.
type SyncResult struct {
	Books     int
	Bookmarks int
	Notes     int
}

// BookInserter is implemented by platform.DataRepo for upserting weread books.
type BookInserter interface {
	UpsertWereadBooks(ctx context.Context, userID int64, items []map[string]any) (map[string]int, error)
}

// BookmarkInserter is implemented by WereadRepo for upserting bookmarks.
type BookmarkInserter interface {
	UpsertBookmarks(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// NoteInserter is implemented by WereadRepo for upserting notes.
type NoteInserter interface {
	UpsertNotes(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// BookRatingUpdater is implemented by platform.DataRepo for updating book rating/status.
type BookRatingUpdater interface {
	UpdateWereadBookRatingStatus(ctx context.Context, userID int64, updates map[string]BookRatingUpdate) error
}

// BookRatingUpdate holds star/isFinish data aggregated from reviews for a single book.
type BookRatingUpdate struct {
	Star     int
	IsFinish bool
}

// SyncWithAPI performs a full sync using the Skill API.
func SyncWithAPI(
	ctx context.Context,
	client *SkillAPIClient,
	bookRepo BookInserter,
	bookmarkRepo BookmarkInserter,
	noteRepo NoteInserter,
	ratingRepo BookRatingUpdater,
	userID int64,
	onProgress ProgressFunc,
) (result SyncResult, err error) {
	// Fetch shelf.
	onProgress("books", 0, 0)
	shelf, err := client.FetchShelf(ctx)
	if err != nil {
		return SyncResult{}, fmt.Errorf("获取书架失败: %w", err)
	}
	log.Printf("[weread-skill] SyncWithAPI: shelf has %d books", len(shelf.Books))

	// Sync books (writes to DB in batches of 50).
	onProgress("books", 0, len(shelf.Books))
	log.Printf("[weread-skill] syncing books…")
	bookCount, err := syncBooks(ctx, client, shelf, bookRepo, userID)
	if err != nil {
		log.Printf("[weread-skill] sync books error: %v", err)
	}
	result.Books = bookCount
	log.Printf("[weread-skill] books done: %d", result.Books)

	// Sync bookmarks.
	onProgress("bookmarks", 0, 0)
	log.Printf("[weread-skill] syncing bookmarks…")
	bookmarks, err := syncBookmarks(ctx, client, shelf)
	if err != nil {
		log.Printf("[weread-skill] sync bookmarks error: %v", err)
	} else if len(bookmarks) > 0 {
		log.Printf("[weread-skill] upserting %d bookmarks…", len(bookmarks))
		bookmarkRepo.UpsertBookmarks(ctx, userID, bookmarks)
		result.Bookmarks = len(bookmarks)
	}
	log.Printf("[weread-skill] bookmarks done: %d", result.Bookmarks)

	// Sync reviews/notes.
	onProgress("reviews", 0, 0)
	log.Printf("[weread-skill] syncing reviews…")
	notes, ratingUpdates, err := syncReviews(ctx, client, shelf)
	if err != nil {
		log.Printf("[weread-skill] sync reviews error: %v", err)
	} else {
		if len(notes) > 0 {
			log.Printf("[weread-skill] upserting %d notes…", len(notes))
			noteRepo.UpsertNotes(ctx, userID, notes)
			result.Notes = len(notes)
		}
		if len(ratingUpdates) > 0 {
			log.Printf("[weread-skill] updating rating/status for %d books…", len(ratingUpdates))
			if err := ratingRepo.UpdateWereadBookRatingStatus(ctx, userID, ratingUpdates); err != nil {
				log.Printf("[weread-skill] update book rating/status error: %v", err)
			}
		}
	}
	log.Printf("[weread-skill] reviews done: %d", result.Notes)

	return result, nil
}

// ---------- Internal helpers ----------

// deriveUserID creates a pseudo user ID from shelf data.
func deriveUserID(shelf *ShelfResponse) string {
	if len(shelf.Books) > 0 {
		return fmt.Sprintf("weread_api_%d", shelf.Books[0].ReadUpdateTime)
	}
	return "weread_api_unknown"
}

// buildProfile creates a profile map from shelf data.
func buildProfile(shelf *ShelfResponse) map[string]any {
	return map[string]any{
		"user_id":  deriveUserID(shelf),
		"name":     "微信读书用户",
		"avatar":   nil,
		"books":    len(shelf.Books),
		"platform": "weread",
	}
}

// syncBooks fetches book details and writes them to DB in batches.
func syncBooks(ctx context.Context, client *SkillAPIClient, shelf *ShelfResponse, bookRepo BookInserter, userID int64) (int, error) {
	if len(shelf.Books) == 0 {
		return 0, nil
	}

	const batchSize = 50
	var (
		mu       sync.Mutex
		batch    []map[string]any
		total    int
		wg       sync.WaitGroup
		sem      = make(chan struct{}, 3)
		errOnce  sync.Once
		firstErr error
	)

	flush := func() {
		if len(batch) == 0 {
			return
		}
		bookRepo.UpsertWereadBooks(ctx, userID, batch)
		total += len(batch)
		log.Printf("[weread-skill] flushed %d books (total: %d/%d)", len(batch), total, len(shelf.Books))
		batch = batch[:0]
	}

	for _, sb := range shelf.Books {
		sb := sb
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			time.Sleep(200 * time.Millisecond)

			info, err := client.FetchBookInfo(ctx, sb.BookID)
			if err != nil {
				log.Printf("[weread-skill] fetch book info %s: %v", sb.BookID, err)
				errOnce.Do(func() { firstErr = err })
				return
			}

			status := "unread"
			if sb.FinishReading == 1 {
				status = "done"
			} else if sb.ReadUpdateTime > 0 {
				status = "reading"
			}

			rating := 0
			if info.NewRating > 0 {
				// WeRead newRating is per-mille (e.g. 824 = 82.4%).
				// Convert to 1-5 star scale for display consistency.
				rating = (info.NewRating * 5 + 500) / 1000 // round to nearest
				if rating < 1 {
					rating = 1
				}
				if rating > 5 {
					rating = 5
				}
			}

			item := map[string]any{
				"url":        fmt.Sprintf("https://weread.qq.com/web/reader/%s", sb.BookID),
				"title":      info.Title,
				"cover":      info.Cover,
				"author":     info.Author,
				"translator": info.Translator,
				"publisher":  info.Publisher,
				"rating":     rating,
				"status":     status,
				"external": map[string]any{
					"category":         info.Category,
					"book_id":          sb.BookID,
					"isbn":             info.ISBN,
					"intro":            info.Intro,
					"new_rating":       info.NewRating,
					"new_rating_count": info.NewRatingCount,
				},
			}

			mu.Lock()
			batch = append(batch, item)
			if len(batch) >= batchSize {
				flush()
			}
			mu.Unlock()
		}()
	}
	wg.Wait()
	// Flush remaining.
	mu.Lock()
	flush()
	mu.Unlock()
	log.Printf("[weread-skill] book info complete: %d/%d succeeded", total, len(shelf.Books))

	return total, firstErr
}

// syncBookmarks fetches all notebooks to find books with bookmarks, then fetches them.
func syncBookmarks(ctx context.Context, client *SkillAPIClient, shelf *ShelfResponse) ([]map[string]any, error) {
	// Build a title lookup from shelf.
	titleMap := make(map[string]string, len(shelf.Books))
	for _, sb := range shelf.Books {
		titleMap[sb.BookID] = sb.Title
	}

	// Fetch notebooks to find which books have bookmarks.
	notebooks, err := client.FetchAllNotebooks(ctx)
	if err != nil {
		return nil, err
	}

	// Filter books that have bookmarks.
	var bookIDs []string
	for _, nb := range notebooks {
		if nb.BookmarkCount > 0 || nb.NoteCount > 0 {
			bookIDs = append(bookIDs, nb.BookID)
		}
	}

	if len(bookIDs) == 0 {
		return nil, nil
	}

	var (
		mu    sync.Mutex
		items []map[string]any
		wg    sync.WaitGroup
		sem   = make(chan struct{}, 3)
	)

	for _, bookID := range bookIDs {
		bookID := bookID
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			time.Sleep(200 * time.Millisecond)

			resp, err := client.FetchBookmarks(ctx, bookID)
			if err != nil {
				log.Printf("[weread-skill] fetch bookmarks %s: %v", bookID, err)
				return
			}

			// Build chapter lookup.
			chapterMap := make(map[int]BookmarkChapter, len(resp.Chapters))
			for _, ch := range resp.Chapters {
				chapterMap[ch.ChapterUID] = ch
			}

			bookTitle := titleMap[bookID]
			if bookTitle == "" {
				bookTitle = bookID
			}

			var batch []map[string]any
			for _, bm := range resp.Updated {
				ch, ok := chapterMap[bm.ChapterUID]
				chapterName := ""
				chapterIdx := 0
				if ok {
					chapterName = ch.Title
					chapterIdx = ch.ChapterIdx
				}

				batch = append(batch, map[string]any{
					"book_id":      bm.BookID,
					"book_title":   bookTitle,
					"mark_text":    bm.MarkText,
					"chapter_name": chapterName,
					"chapter_idx":  chapterIdx,
					"style":        bm.ColorStyle,
					"create_time":  bm.CreateTime,
					"bookmark_id":  bm.BookmarkID,
				})
			}

			if len(batch) > 0 {
				mu.Lock()
				items = append(items, batch...)
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	return items, nil
}

// syncReviews fetches reviews for books that have them.
// Returns note items and a map of bookID → {star, isFinish} aggregated from reviews.
func syncReviews(ctx context.Context, client *SkillAPIClient, shelf *ShelfResponse) ([]map[string]any, map[string]BookRatingUpdate, error) {
	// Build a title lookup from shelf.
	titleMap := make(map[string]string, len(shelf.Books))
	for _, sb := range shelf.Books {
		titleMap[sb.BookID] = sb.Title
	}

	// Fetch notebooks to find which books have reviews.
	notebooks, err := client.FetchAllNotebooks(ctx)
	if err != nil {
		return nil, nil, err
	}

	// Supplement title map from notebooks (covers books not on shelf).
	for _, nb := range notebooks {
		if nb.Book != nil && nb.Book.Title != "" {
			if _, exists := titleMap[nb.BookID]; !exists {
				titleMap[nb.BookID] = nb.Book.Title
			}
		}
	}

	// Filter books that have reviews.
	var bookIDs []string
	for _, nb := range notebooks {
		if nb.ReviewCount > 0 {
			bookIDs = append(bookIDs, nb.BookID)
		}
	}

	if len(bookIDs) == 0 {
		return nil, nil, nil
	}

	var (
		mu            sync.Mutex
		items         []map[string]any
		ratingUpdates map[string]BookRatingUpdate
		wg            sync.WaitGroup
		sem           = make(chan struct{}, 3)
	)

	for _, bookID := range bookIDs {
		bookID := bookID
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()

			time.Sleep(200 * time.Millisecond)

			reviews, err := client.FetchAllReviews(ctx, bookID)
			if err != nil {
				log.Printf("[weread-skill] fetch reviews %s: %v", bookID, err)
				return
			}

			bookTitle := titleMap[bookID]
			if bookTitle == "" {
				bookTitle = bookID
			}

			var batch []map[string]any
			var lastStar int = -1
			var hasFinish bool
			for _, r := range reviews {
				detail := r.Review
				chapterName := detail.ChapterName
				if chapterName == "" {
					chapterName = fmt.Sprintf("Chapter %d", detail.ChapterIdx)
				}
				batch = append(batch, map[string]any{
					"title":    fmt.Sprintf("%s - %s", bookTitle, chapterName),
					"url":      fmt.Sprintf("weread://review/%s", r.ReviewID),
					"date":     fmt.Sprintf("%d", detail.CreateTime),
					"location": chapterName,
					"body":     detail.Content,
					"book_id":  bookID,
					"abstract": detail.Abstract,
				})
				// Aggregate star/isFinish: take the last valid star and any finish.
				if detail.Star > 0 {
					lastStar = detail.Star
				}
				if detail.IsFinish == 1 {
					hasFinish = true
				}
			}

			if len(batch) > 0 {
				mu.Lock()
				items = append(items, batch...)
				if lastStar > 0 || hasFinish {
					if ratingUpdates == nil {
						ratingUpdates = make(map[string]BookRatingUpdate)
					}
					ratingUpdates[bookID] = BookRatingUpdate{Star: lastStar, IsFinish: hasFinish}
				}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	return items, ratingUpdates, nil
}
