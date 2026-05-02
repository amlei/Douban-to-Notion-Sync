package data

import (
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"

	"github.com/uptrace/bun"
)

type DataRepo struct {
	db *bun.DB
}

func NewDataRepo(db *bun.DB) *DataRepo {
	return &DataRepo{db: db}
}

// UpsertBooks inserts or updates Douban books.
func (r *DataRepo) UpsertBooks(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		book := bookRowFromMap(item)
		book.UserID = userID
		book.PlatformID = PlatformDouban
		_, err := r.db.NewInsert().Model(book).
			On("CONFLICT (user_id, url, platform_id) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, author = EXCLUDED.author, country = EXCLUDED.country, translator = EXCLUDED.translator, publisher = EXCLUDED.publisher, pub_date = EXCLUDED.pub_date, price = EXCLUDED.price, rating = EXCLUDED.rating, read_date = EXCLUDED.read_date, status = EXCLUDED.status, tags = EXCLUDED.tags, comment = EXCLUDED.comment").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// UpsertWereadBooks inserts or updates WeRead books with change detection.
func (r *DataRepo) UpsertWereadBooks(ctx context.Context, userID int64, items []map[string]any) (map[string]int, error) {
	result := map[string]int{"total": len(items), "updated": 0, "unchanged": 0}

	// Load existing books for change detection
	var existing []BookRow
	r.db.NewSelect().Model(&existing).
		Where("user_id = ? AND platform_id = ?", userID, PlatformWeread).
		Scan(ctx)
	existingMap := map[string]*BookRow{}
	for i := range existing {
		existingMap[existing[i].URL] = &existing[i]
	}

	for _, item := range items {
		book := bookRowFromMap(item)
		book.UserID = userID
		book.PlatformID = PlatformWeread

		if existing, ok := existingMap[book.URL]; ok {
			if existing.ChangeHash() == book.ChangeHash() {
				result["unchanged"]++
				continue
			}
		}

		_, err := r.db.NewInsert().Model(book).
			On("CONFLICT (user_id, url, platform_id) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, author = EXCLUDED.author, translator = EXCLUDED.translator, publisher = EXCLUDED.publisher, price = EXCLUDED.price, rating = EXCLUDED.rating, status = EXCLUDED.status, external = EXCLUDED.external").
			Exec(ctx)
		if err != nil {
			return result, err
		}
		result["updated"]++
	}
	return result, nil
}

// GetBookmarkSynckeys returns {book_id: bookmark_synckey} for all WeRead books.
func (r *DataRepo) GetBookmarkSynckeys(ctx context.Context, userID int64) (map[string]int, error) {
	var books []BookRow
	err := r.db.NewSelect().Model(&books).
		Where("user_id = ? AND platform_id = ?", userID, PlatformWeread).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	result := map[string]int{}
	for _, b := range books {
		if b.External != nil {
			var ext map[string]any
			json.Unmarshal([]byte(*b.External), &ext)
			if sk, ok := ext["bookmark_synckey"]; ok {
				switch v := sk.(type) {
				case float64:
					result[b.URL] = int(v)
				case int:
					result[b.URL] = v
				}
			}
		}
	}
	return result, nil
}

// UpdateBookmarkSynckey updates the synckey in the external JSON of a WeRead book.
func (r *DataRepo) UpdateBookmarkSynckey(ctx context.Context, userID int64, bookID string, synckey int) error {
	book := &BookRow{}
	err := r.db.NewSelect().Model(book).
		Where("user_id = ? AND platform_id = ? AND url = ?", userID, PlatformWeread, bookID).
		Scan(ctx)
	if err != nil {
		return err
	}
	var ext map[string]any
	if book.External != nil {
		json.Unmarshal([]byte(*book.External), &ext)
	}
	if ext == nil {
		ext = map[string]any{}
	}
	ext["bookmark_synckey"] = synckey
	extJSON, _ := json.Marshal(ext)
	extStr := string(extJSON)
	book.External = &extStr
	_, err = r.db.NewUpdate().Model(book).WherePK().Column("external").Exec(ctx)
	return err
}

// UpsertMovies inserts or updates movies.
func (r *DataRepo) UpsertMovies(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		movie := movieRowFromMap(item)
		movie.UserID = userID
		_, err := r.db.NewInsert().Model(movie).
			On("CONFLICT (user_id, url) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, release_date = EXCLUDED.release_date, rating = EXCLUDED.rating, watch_date = EXCLUDED.watch_date, tags = EXCLUDED.tags, comment = EXCLUDED.comment").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// UpsertGames inserts or updates games.
func (r *DataRepo) UpsertGames(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		game := gameRowFromMap(item)
		game.UserID = userID
		_, err := r.db.NewInsert().Model(game).
			On("CONFLICT (user_id, url) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, description = EXCLUDED.description, rating = EXCLUDED.rating, release_date = EXCLUDED.release_date, play_date = EXCLUDED.play_date, tags = EXCLUDED.tags, comment = EXCLUDED.comment").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// UpsertReviews inserts or updates reviews.
func (r *DataRepo) UpsertReviews(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		review := reviewRowFromMap(item)
		review.UserID = userID
		_, err := r.db.NewInsert().Model(review).
			On("CONFLICT (user_id, review_url) DO UPDATE").
			Set("subject_title = EXCLUDED.subject_title, subject_url = EXCLUDED.subject_url, subject_img_url = EXCLUDED.subject_img_url, review_title = EXCLUDED.review_title, date = EXCLUDED.date").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// UpsertNotes inserts or updates notes.
func (r *DataRepo) UpsertNotes(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		note := noteRowFromMap(item)
		note.UserID = userID
		_, err := r.db.NewInsert().Model(note).
			On("CONFLICT (user_id, url) DO UPDATE").
			Set("title = EXCLUDED.title, date = EXCLUDED.date, location = EXCLUDED.location, body = EXCLUDED.body").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// UpsertFlomoMemos inserts or updates Flomo memos with change detection.
func (r *DataRepo) UpsertFlomoMemos(ctx context.Context, userID int64, items []map[string]any) (map[string]int, error) {
	result := map[string]int{"total": len(items), "updated": 0, "unchanged": 0}

	var existing []FlomoMemoRow
	r.db.NewSelect().Model(&existing).
		Where("user_id = ? AND platform_id = ?", userID, PlatformFlomo).
		Scan(ctx)
	existingMap := map[string]*FlomoMemoRow{}
	for i := range existing {
		existingMap[existing[i].MemoCreatedAt] = &existing[i]
	}

	for _, item := range items {
		memo := flomoMemoRowFromMap(item)
		memo.UserID = userID
		memo.PlatformID = PlatformFlomo

		if ex, ok := existingMap[memo.MemoCreatedAt]; ok {
			contentMatch := ex.Content == memo.Content
			tagsMatch := strPtrEqual(ex.Tags, memo.Tags)
			filesMatch := strPtrEqual(ex.Files, memo.Files)
			if contentMatch && tagsMatch && filesMatch {
				result["unchanged"]++
				continue
			}
		}

		_, err := r.db.NewInsert().Model(memo).
			On("CONFLICT (user_id, platform_id, memo_created_at) DO UPDATE").
			Set("content = EXCLUDED.content, tags = EXCLUDED.tags, files = EXCLUDED.files").
			Exec(ctx)
		if err != nil {
			return result, err
		}
		result["updated"]++
	}
	return result, nil
}

// UpsertBookmarks inserts or updates WeRead bookmarks.
func (r *DataRepo) UpsertBookmarks(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		bm := bookmarkRowFromMap(item)
		bm.UserID = userID
		bm.PlatformID = PlatformWeread
		_, err := r.db.NewInsert().Model(bm).
			On("CONFLICT (user_id, platform_id, book_id, bookmark_id) DO UPDATE").
			Set("mark_text = EXCLUDED.mark_text, chapter_name = EXCLUDED.chapter_name, chapter_idx = EXCLUDED.chapter_idx, style = EXCLUDED.style, create_time = EXCLUDED.create_time, book_title = EXCLUDED.book_title").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// GetBooks retrieves all books for a user.
func (r *DataRepo) GetBooks(ctx context.Context, userID int64) ([]BookRow, error) {
	var books []BookRow
	err := r.db.NewSelect().Model(&books).Where("user_id = ?", userID).Scan(ctx)
	return books, err
}

// GetMovies retrieves all movies for a user.
func (r *DataRepo) GetMovies(ctx context.Context, userID int64) ([]MovieRow, error) {
	var movies []MovieRow
	err := r.db.NewSelect().Model(&movies).Where("user_id = ?", userID).Scan(ctx)
	return movies, err
}

// GetGames retrieves all games for a user.
func (r *DataRepo) GetGames(ctx context.Context, userID int64) ([]GameRow, error) {
	var games []GameRow
	err := r.db.NewSelect().Model(&games).Where("user_id = ?", userID).Scan(ctx)
	return games, err
}

// GetReviews retrieves all reviews for a user.
func (r *DataRepo) GetReviews(ctx context.Context, userID int64) ([]ReviewRow, error) {
	var reviews []ReviewRow
	err := r.db.NewSelect().Model(&reviews).Where("user_id = ?", userID).Scan(ctx)
	return reviews, err
}

// GetNotes retrieves all notes for a user.
func (r *DataRepo) GetNotes(ctx context.Context, userID int64) ([]NoteRow, error) {
	var notes []NoteRow
	err := r.db.NewSelect().Model(&notes).Where("user_id = ?", userID).Scan(ctx)
	return notes, err
}

// GetFlomoMemos retrieves all Flomo memos for a user.
func (r *DataRepo) GetFlomoMemos(ctx context.Context, userID int64) ([]FlomoMemoRow, error) {
	var memos []FlomoMemoRow
	err := r.db.NewSelect().Model(&memos).Where("user_id = ?", userID).Scan(ctx)
	return memos, err
}

// GetBookmarks retrieves all bookmarks for a user.
func (r *DataRepo) GetBookmarks(ctx context.Context, userID int64) ([]BookmarkRow, error) {
	var bookmarks []BookmarkRow
	err := r.db.NewSelect().Model(&bookmarks).Where("user_id = ?", userID).Scan(ctx)
	return bookmarks, err
}

// Helper functions for converting maps to model structs.

func strPtr(v string) *string { return &v }
func intPtr(v int) *int       { return &v }
func int64Ptr(v int64) *int64 { return &v }

func getStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		s := fmt.Sprintf("%v", v)
		return &s
	}
	return nil
}

func getInt(m map[string]any, key string) *int {
	if v, ok := m[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int(n)
			return &i
		case int:
			return &n
		}
	}
	return nil
}

func getInt64(m map[string]any, key string) *int64 {
	if v, ok := m[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int64(n)
			return &i
		case int:
			i := int64(n)
			return &i
		case int64:
			return &n
		}
	}
	return nil
}

func getJSONStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		b, _ := json.Marshal(v)
		s := string(b)
		return &s
	}
	return nil
}

func strPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func bookRowFromMap(m map[string]any) *BookRow {
	return &BookRow{
		Title:      fmt.Sprintf("%v", m["title"]),
		URL:        fmt.Sprintf("%v", m["url"]),
		Cover:      getStr(m, "cover"),
		Author:     getStr(m, "author"),
		Country:    getStr(m, "country"),
		Translator: getStr(m, "translator"),
		Publisher:  getStr(m, "publisher"),
		PubDate:    getStr(m, "pub_date"),
		Price:      getStr(m, "price"),
		Rating:     getInt(m, "rating"),
		ReadDate:   getStr(m, "read_date"),
		Status:     getStr(m, "status"),
		Tags:       getJSONStr(m, "tags"),
		Comment:    getStr(m, "comment"),
		External:   getJSONStr(m, "external"),
	}
}

func movieRowFromMap(m map[string]any) *MovieRow {
	return &MovieRow{
		Title:       fmt.Sprintf("%v", m["title"]),
		URL:         fmt.Sprintf("%v", m["url"]),
		Cover:       getStr(m, "cover"),
		ReleaseDate: getStr(m, "release_date"),
		Rating:      getInt(m, "rating"),
		WatchDate:   getStr(m, "watch_date"),
		Tags:        getJSONStr(m, "tags"),
		Comment:     getStr(m, "comment"),
	}
}

func gameRowFromMap(m map[string]any) *GameRow {
	return &GameRow{
		Title:       fmt.Sprintf("%v", m["title"]),
		URL:         fmt.Sprintf("%v", m["url"]),
		Cover:       getStr(m, "cover"),
		Description: getStr(m, "desc"),
		Rating:      getInt(m, "rating"),
		ReleaseDate: getStr(m, "release_date"),
		PlayDate:    getStr(m, "play_date"),
		Tags:        getJSONStr(m, "tags"),
		Comment:     getStr(m, "comment"),
	}
}

func reviewRowFromMap(m map[string]any) *ReviewRow {
	return &ReviewRow{
		SubjectTitle:  fmt.Sprintf("%v", m["subject_title"]),
		SubjectURL:    getStr(m, "subject_url"),
		SubjectImgURL: getStr(m, "subject_img_url"),
		ReviewTitle:   getStr(m, "review_title"),
		ReviewURL:     getStr(m, "review_url"),
		Date:          getStr(m, "date"),
	}
}

func noteRowFromMap(m map[string]any) *NoteRow {
	return &NoteRow{
		Title:    fmt.Sprintf("%v", m["title"]),
		URL:      getStr(m, "url"),
		Date:     getStr(m, "date"),
		Location: getStr(m, "location"),
		Body:     getStr(m, "body"),
	}
}

func bookmarkRowFromMap(m map[string]any) *BookmarkRow {
	return &BookmarkRow{
		BookID:      fmt.Sprintf("%v", m["book_id"]),
		BookTitle:   getStr(m, "book_title"),
		MarkText:    fmt.Sprintf("%v", m["mark_text"]),
		ChapterName: getStr(m, "chapter_name"),
		ChapterIdx:  getInt(m, "chapter_idx"),
		Style:       getInt(m, "style"),
		CreateTime:  getInt64(m, "create_time"),
		BookmarkID:  getStr(m, "bookmark_id"),
	}
}

func flomoMemoRowFromMap(m map[string]any) *FlomoMemoRow {
	return &FlomoMemoRow{
		Content:       fmt.Sprintf("%v", m["content"]),
		Tags:          getJSONStr(m, "tags"),
		Files:         getJSONStr(m, "files"),
		MemoCreatedAt: fmt.Sprintf("%v", m["memo_created_at"]),
	}
}

// ChangeHashFromValues computes the change hash for book upsert comparison.
func ChangeHashFromValues(values map[string]any) string {
	status := ""
	if v, ok := values["status"]; ok && v != nil {
		status = fmt.Sprintf("%v", v)
	}
	rating := ""
	if v, ok := values["rating"]; ok && v != nil {
		rating = fmt.Sprintf("%v", v)
	}
	ext := ""
	if v, ok := values["external"]; ok && v != nil {
		ext = fmt.Sprintf("%v", v)
	}
	payload := fmt.Sprintf("%s|%s|%s", status, rating, ext)
	return fmt.Sprintf("%x", md5.Sum([]byte(payload)))
}
