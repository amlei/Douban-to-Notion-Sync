package weread

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/uptrace/bun"
)

type WereadRepo struct {
	db *bun.DB
}

func NewWereadRepo(db *bun.DB) *WereadRepo {
	return &WereadRepo{db: db}
}

const PlatformWeread = 2

func (r *WereadRepo) UpsertBookmarks(ctx context.Context, userID int64, items []map[string]any) (int, error) {
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

func (r *WereadRepo) UpsertNotes(ctx context.Context, userID int64, items []map[string]any) (int, error) {
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

func (r *WereadRepo) GetBookmarks(ctx context.Context, userID int64) ([]BookmarkRow, error) {
	var bookmarks []BookmarkRow
	err := r.db.NewSelect().Model(&bookmarks).Where("user_id = ?", userID).Scan(ctx)
	return bookmarks, err
}

func (r *WereadRepo) GetNotes(ctx context.Context, userID int64) ([]NoteRow, error) {
	var notes []NoteRow
	err := r.db.NewSelect().Model(&notes).Where("user_id = ?", userID).Scan(ctx)
	return notes, err
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

func noteRowFromMap(m map[string]any) *NoteRow {
	return &NoteRow{
		Title:    fmt.Sprintf("%v", m["title"]),
		URL:      getStr(m, "url"),
		Date:     getStr(m, "date"),
		Location: getStr(m, "location"),
		Body:     getStr(m, "body"),
	}
}

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
