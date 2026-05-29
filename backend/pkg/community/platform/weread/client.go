package weread

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"time"
)

const (
	gatewayURL   = "https://i.weread.qq.com/api/agent/gateway"
	skillVersion = "1.0.3"
)

// SkillAPIClient wraps HTTP calls to the WeRead Skill API gateway.
type SkillAPIClient struct {
	apiKey     string
	httpClient *http.Client
}

// NewSkillAPIClient creates a client with the given API key.
func NewSkillAPIClient(apiKey string) *SkillAPIClient {
	return &SkillAPIClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ---------- Response types ----------

// ShelfResponse is the response from /shelf/sync.
type ShelfResponse struct {
	Books  []ShelfBook `json:"books"`
	Albums []any       `json:"albums"`
}

// ShelfBook is a single book entry from the shelf.
type ShelfBook struct {
	BookID         string `json:"bookId"`
	Title          string `json:"title"`
	Author         string `json:"author"`
	Cover          string `json:"cover"`
	Category       string `json:"category"`
	ReadUpdateTime int64  `json:"readUpdateTime"`
	UpdateTime     int64  `json:"updateTime"`
	FinishReading  int    `json:"finishReading"`
	Secret         int    `json:"secret"`
}

// BookInfo is the detailed book info from /book/info.
type BookInfo struct {
	BookID         string `json:"bookId"`
	Title          string `json:"title"`
	Author         string `json:"author"`
	Translator     string `json:"translator"`
	Cover          string `json:"cover"`
	Intro          string `json:"intro"`
	ISBN           string `json:"isbn"`
	Publisher      string `json:"publisher"`
	PublishTime    string `json:"publishTime"`
	WordCount      int64  `json:"wordCount"`
	NewRating      int    `json:"newRating"`
	NewRatingCount int    `json:"newRatingCount"`
	Category       string `json:"category"`
}

// BookmarkChapter is a chapter entry from /book/bookmarklist.
type BookmarkChapter struct {
	ChapterUID int    `json:"chapterUid"`
	ChapterIdx int    `json:"chapterIdx"`
	Title      string `json:"title"`
}

// BookmarkItem is a single bookmark (highlight) entry.
type BookmarkItem struct {
	BookmarkID string `json:"bookmarkId"`
	BookID     string `json:"bookId"`
	ChapterUID int    `json:"chapterUid"`
	MarkText   string `json:"markText"`
	CreateTime int64  `json:"createTime"`
	Type       int    `json:"type"`
	Range      string `json:"range"`
	ColorStyle int    `json:"colorStyle"`
}

// BookmarkResponse is the response from /book/bookmarklist.
type BookmarkResponse struct {
	Updated  []BookmarkItem    `json:"updated"`
	Chapters []BookmarkChapter `json:"chapters"`
}

// ReviewItem is a single review (thought/annotation) entry.
// The API returns {"reviewId": "...", "review": {content, chapterName, ...}}.
type ReviewItem struct {
	ReviewID string       `json:"reviewId"`
	Review   ReviewDetail `json:"review"`
}

// ReviewDetail holds the actual review content, nested under "review".
type ReviewDetail struct {
	BookID      string `json:"bookId"`
	Content     string `json:"content"`
	CreateTime  int64  `json:"createTime"`
	ChapterUID  int    `json:"chapterUid"`
	ChapterName string `json:"chapterName"`
	ChapterIdx  int    `json:"chapterIdx"`
	Abstract    string `json:"abstract"`
}

// ReviewListResponse is the response from /review/list/mine.
type ReviewListResponse struct {
	Reviews []ReviewItem `json:"reviews"`
	SyncKey int          `json:"synckey"`
}

// NotebookBook is a book entry from /user/notebooks.
type NotebookBook struct {
	BookID        string `json:"bookId"`
	ReviewCount   int    `json:"reviewCount"`
	NoteCount     int    `json:"noteCount"`
	BookmarkCount int    `json:"bookmarkCount"`
	Sort          int64  `json:"sort"`
}

// NotebooksResponse is the response from /user/notebooks.
type NotebooksResponse struct {
	Books          []NotebookBook `json:"books"`
	TotalBookCount int            `json:"totalBookCount"`
	HasMore        int            `json:"hasMore"`
}

// ---------- Public methods ----------

// ValidateKey checks if the API key is valid by calling /user/notebooks.
func (c *SkillAPIClient) ValidateKey(ctx context.Context) error {
	_, err := c.FetchNotebooks(ctx, 0)
	return err
}

// FetchShelf retrieves the full book shelf.
func (c *SkillAPIClient) FetchShelf(ctx context.Context) (*ShelfResponse, error) {
	var resp ShelfResponse
	if err := c.call(ctx, "/shelf/sync", nil, &resp); err != nil {
		return nil, fmt.Errorf("fetch shelf: %w", err)
	}
	return &resp, nil
}

// FetchBookInfo retrieves detailed info for a single book.
func (c *SkillAPIClient) FetchBookInfo(ctx context.Context, bookID string) (*BookInfo, error) {
	var resp BookInfo
	params := map[string]any{"bookId": bookID}
	if err := c.call(ctx, "/book/info", params, &resp); err != nil {
		return nil, fmt.Errorf("fetch book info %s: %w", bookID, err)
	}
	return &resp, nil
}

// FetchBookmarks retrieves bookmarks for a single book.
func (c *SkillAPIClient) FetchBookmarks(ctx context.Context, bookID string) (*BookmarkResponse, error) {
	var resp BookmarkResponse
	params := map[string]any{"bookId": bookID}
	if err := c.call(ctx, "/book/bookmarklist", params, &resp); err != nil {
		return nil, fmt.Errorf("fetch bookmarks %s: %w", bookID, err)
	}
	return &resp, nil
}

// FetchReviews retrieves reviews (thoughts) for a single book, with pagination.
func (c *SkillAPIClient) FetchReviews(ctx context.Context, bookID string, synckey int) (*ReviewListResponse, error) {
	var resp ReviewListResponse
	params := map[string]any{
		"bookid":      bookID, // lowercase — this API uses "bookid" not "bookId"
		"listType":    11,
		"mine":        1,
		"syncKey":     synckey,
		"listTypeInt": 0,
	}
	if err := c.call(ctx, "/review/list/mine", params, &resp); err != nil {
		return nil, fmt.Errorf("fetch reviews %s: %w", bookID, err)
	}
	return &resp, nil
}

// FetchAllReviews fetches all reviews for a book by paginating through synckey.
func (c *SkillAPIClient) FetchAllReviews(ctx context.Context, bookID string) ([]ReviewItem, error) {
	var all []ReviewItem
	synckey := 0
	for {
		resp, err := c.FetchReviews(ctx, bookID, synckey)
		if err != nil {
			return all, err
		}
		all = append(all, resp.Reviews...)
		if resp.SyncKey == 0 || len(resp.Reviews) == 0 {
			break
		}
		synckey = resp.SyncKey
		time.Sleep(200 * time.Millisecond)
	}
	return all, nil
}

// FetchNotebooks retrieves the list of books that have notes, with pagination.
func (c *SkillAPIClient) FetchNotebooks(ctx context.Context, lastSort int) (*NotebooksResponse, error) {
	var resp NotebooksResponse
	params := map[string]any{}
	if lastSort > 0 {
		params["lastSort"] = lastSort
	}
	if err := c.call(ctx, "/user/notebooks", params, &resp); err != nil {
		return nil, fmt.Errorf("fetch notebooks: %w", err)
	}
	return &resp, nil
}

// FetchAllNotebooks paginates through all notebooks.
func (c *SkillAPIClient) FetchAllNotebooks(ctx context.Context) ([]NotebookBook, error) {
	var all []NotebookBook
	lastSort := 0
	for {
		resp, err := c.FetchNotebooks(ctx, lastSort)
		if err != nil {
			return all, err
		}
		all = append(all, resp.Books...)
		if resp.HasMore == 0 || len(resp.Books) == 0 {
			break
		}
		// Use the last book's sort as the cursor for the next page.
		last := resp.Books[len(resp.Books)-1]
		lastSort = int(last.Sort)
		time.Sleep(200 * time.Millisecond)
	}
	return all, nil
}

// ---------- Internal ----------

// call sends a request to the Skill API gateway with retry logic.
// The gateway expects skill_version and api_name as top-level fields,
// with all API-specific parameters also at the top level (not nested).
func (c *SkillAPIClient) call(ctx context.Context, apiName string, params any, result any) error {
	// Merge everything into a flat top-level map.
	payload := map[string]any{
		"skill_version": skillVersion,
		"api_name":      apiName,
	}
	if m, ok := params.(map[string]any); ok {
		for k, v := range m {
			payload[k] = v
		}
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			delay := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			log.Printf("[weread-skill] retry %d for %s after %v", attempt, apiName, delay)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, "POST", gatewayURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("skill API returned status %d: %s", resp.StatusCode, string(respBody))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("skill API returned status %d: %s", resp.StatusCode, string(respBody))
		}

		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("decode response for %s: %w (body: %s)", apiName, err, string(respBody))
		}

		return nil
	}

	return fmt.Errorf("skill API %s failed after 3 retries: %w", apiName, lastErr)
}
