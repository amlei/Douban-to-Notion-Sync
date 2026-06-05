package douban

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// ProgressFunc reports sync progress (matches weread pattern).
type ProgressFunc func(phase string, current, total int)

// SyncResult holds counts from a Douban sync operation.
type SyncResult struct {
	Books   int
	Movies  int
	Games   int
	Reviews int
	Notes   int
}

// BookInserter is implemented by platform.DataRepo.
type BookInserter interface {
	UpsertBooks(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// MovieInserter is implemented by DoubanRepo.
type MovieInserter interface {
	UpsertMovies(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// GameInserter is implemented by DoubanRepo.
type GameInserter interface {
	UpsertGames(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// ReviewInserter is implemented by DoubanRepo.
type ReviewInserter interface {
	UpsertReviews(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// NoteInserter is implemented by weread.WereadRepo (notes table is shared).
type NoteInserter interface {
	UpsertNotes(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// FetchProfile scrapes and returns the Douban user profile.
// Used by both sync and refresh flows.
func FetchProfile(ctx context.Context, client *DoubanClient) (map[string]any, error) {
	if client.userID == "" {
		if _, err := client.ExtractUserID(ctx); err != nil {
			return nil, fmt.Errorf("extract user ID: %w", err)
		}
	}

	url := baseURL + "/people/" + client.userID + "/"
	doc, err := client.fetchPage(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("fetch profile: %w", err)
	}
	return ScrapeProfile(doc, client.userID), nil
}

// SyncWithCookies performs a full Douban data sync using cookie-based auth.
// Follows the same pattern as weread.SyncWithAPI:
//  1. Scrape books (with pagination, rate limiting)
//  2. Scrape movies (with pagination)
//  3. Scrape games (single page)
//  4. Scrape reviews (with pagination)
//  5. Scrape notes (with pagination)
func SyncWithCookies(
	ctx context.Context,
	client *DoubanClient,
	bookRepo BookInserter,
	movieRepo MovieInserter,
	gameRepo GameInserter,
	reviewRepo ReviewInserter,
	noteRepo NoteInserter,
	userID int64,
	existingBookURLs map[string]bool,
	existingMovieURLs map[string]bool,
	onProgress ProgressFunc,
) (SyncResult, error) {
	var result SyncResult

	// Ensure user ID is available.
	if client.userID == "" {
		if _, err := client.ExtractUserID(ctx); err != nil {
			return SyncResult{}, fmt.Errorf("extract user ID: %w", err)
		}
	}

	uid := client.userID

	// 1. Books.
	onProgress("books", 0, 0)
	log.Printf("[douban-go] syncing books for user %s…", uid)
	bookCount, err := syncPaginated(ctx, client, bookRepo, userID,
		func(page int) string {
			return fmt.Sprintf("https://book.douban.com/people/%s/collect?start=%d", uid, (page-1)*15)
		},
		ScrapeBooks,
		existingBookURLs,
	)
	if err != nil {
		log.Printf("[douban-go] sync books error: %v", err)
	}
	result.Books = bookCount
	log.Printf("[douban-go] books done: %d", result.Books)

	// 2. Movies.
	onProgress("movies", 0, 0)
	log.Printf("[douban-go] syncing movies for user %s…", uid)
	movieCount, err := syncPaginated(ctx, client, movieRepo, userID,
		func(page int) string {
			return fmt.Sprintf("https://movie.douban.com/people/%s/collect?start=%d", uid, (page-1)*15)
		},
		ScrapeMovies,
		existingMovieURLs,
	)
	if err != nil {
		log.Printf("[douban-go] sync movies error: %v", err)
	}
	result.Movies = movieCount
	log.Printf("[douban-go] movies done: %d", result.Movies)

	// 3. Games (single page, no pagination).
	onProgress("games", 0, 0)
	log.Printf("[douban-go] syncing games for user %s…", uid)
	gameURL := fmt.Sprintf("%s/people/%s/games?action=collect", baseURL, uid)
	gameDoc, err := client.fetchPage(ctx, gameURL)
	if err != nil {
		log.Printf("[douban-go] sync games error: %v", err)
	} else {
		games := ScrapeGames(gameDoc)
		if len(games) > 0 {
			count, err := gameRepo.UpsertGames(ctx, userID, games)
			if err != nil {
				log.Printf("[douban-go] upsert games error: %v", err)
			}
			result.Games = count
		}
	}
	log.Printf("[douban-go] games done: %d", result.Games)

	// 4. Reviews.
	onProgress("reviews", 0, 0)
	log.Printf("[douban-go] syncing reviews for user %s…", uid)
	reviewCount, err := syncPaginated(ctx, client, reviewRepo, userID,
		func(page int) string {
			return fmt.Sprintf("%s/people/%s/reviews?start=%d", baseURL, uid, (page-1)*10)
		},
		ScrapeReviews,
		nil, // No incremental check for reviews — always scrape all.
	)
	if err != nil {
		log.Printf("[douban-go] sync reviews error: %v", err)
	}
	result.Reviews = reviewCount
	log.Printf("[douban-go] reviews done: %d", result.Reviews)

	// 5. Notes.
	onProgress("notes", 0, 0)
	log.Printf("[douban-go] syncing notes for user %s…", uid)
	noteCount, err := syncPaginated(ctx, client, noteRepo, userID,
		func(page int) string {
			return fmt.Sprintf("%s/people/%s/notes?start=%d&type=note", baseURL, uid, (page-1)*10)
		},
		ScrapeNotes,
		nil, // No incremental check for notes.
	)
	if err != nil {
		log.Printf("[douban-go] sync notes error: %v", err)
	}
	result.Notes = noteCount
	log.Printf("[douban-go] notes done: %d", result.Notes)

	return result, nil
}

// paginatedInserter is the common interface for paginated upserts.
type paginatedInserter interface {
	UpsertItems(ctx context.Context, userID int64, items []map[string]any) (int, error)
}

// wrapBookInserter wraps BookInserter into the common interface.
type bookInserterWrapper struct{ repo BookInserter }

func (w bookInserterWrapper) UpsertItems(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	return w.repo.UpsertBooks(ctx, userID, items)
}

// wrapMovieInserter wraps MovieInserter.
type movieInserterWrapper struct{ repo MovieInserter }

func (w movieInserterWrapper) UpsertItems(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	return w.repo.UpsertMovies(ctx, userID, items)
}

// wrapReviewInserter wraps ReviewInserter.
type reviewInserterWrapper struct{ repo ReviewInserter }

func (w reviewInserterWrapper) UpsertItems(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	return w.repo.UpsertReviews(ctx, userID, items)
}

// wrapNoteInserter wraps NoteInserter.
type noteInserterWrapper struct{ repo NoteInserter }

func (w noteInserterWrapper) UpsertItems(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	return w.repo.UpsertNotes(ctx, userID, items)
}

// scrapeFunc parses a single page of items from a goquery document.
type scrapeFunc func(doc *goquery.Document) []map[string]any

// syncPaginated scrapes all pages for a data type with incremental sync support.
// Port of Python's BaseScraper.scrape() with pagination and rate limiting.
func syncPaginated(
	ctx context.Context,
	client *DoubanClient,
	repo interface{},
	userID int64,
	urlFunc func(page int) string,
	parsePage scrapeFunc,
	existingURLs map[string]bool,
) (int, error) {
	// Wrap repo into common interface.
	var inserter paginatedInserter
	switch r := repo.(type) {
	case BookInserter:
		inserter = bookInserterWrapper{r}
	case MovieInserter:
		inserter = movieInserterWrapper{r}
	case ReviewInserter:
		inserter = reviewInserterWrapper{r}
	case NoteInserter:
		inserter = noteInserterWrapper{r}
	default:
		return 0, fmt.Errorf("unsupported repo type: %T", repo)
	}

	totalCount := 0
	totalPages := 1

	for pageNum := 1; ; pageNum++ {
		url := urlFunc(pageNum)
		doc, err := client.fetchPage(ctx, url)
		if err != nil {
			return totalCount, fmt.Errorf("fetch page %d: %w", pageNum, err)
		}

		// Determine total pages from the first page.
		if pageNum == 1 {
			totalPages = getTotalPages(doc)
		}

		pageItems := parsePage(doc)

		// Incremental sync: filter out existing URLs.
		if existingURLs != nil && len(existingURLs) > 0 {
			var newItems []map[string]any
			for _, item := range pageItems {
				urlVal, _ := item["url"].(string)
				if !existingURLs[urlVal] {
					newItems = append(newItems, item)
				}
			}
			// If all items on this page already exist, stop paginating.
			if len(newItems) < len(pageItems) {
				if len(newItems) > 0 {
					count, err := inserter.UpsertItems(ctx, userID, newItems)
					if err != nil {
						return totalCount, err
					}
					totalCount += count
				}
				break
			}
			pageItems = newItems
		}

		if len(pageItems) > 0 {
			count, err := inserter.UpsertItems(ctx, userID, pageItems)
			if err != nil {
				return totalCount, err
			}
			totalCount += count
		}

		if pageNum >= totalPages {
			break
		}

		// Rate limit: 3-6 second random delay between pages.
		delay := time.Duration(3+rand.Intn(4)) * time.Second
		select {
		case <-ctx.Done():
			return totalCount, ctx.Err()
		case <-time.After(delay):
		}
	}

	return totalCount, nil
}
