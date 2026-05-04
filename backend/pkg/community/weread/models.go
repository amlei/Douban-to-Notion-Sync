package weread

import (
	"time"

	"github.com/uptrace/bun"
)

type BookmarkRow struct {
	bun.BaseModel `bun:"table:bookmarks"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	PlatformID    int       `bun:"platform_id"`
	BookID        string    `bun:"book_id"`
	BookTitle     *string   `bun:"book_title"`
	MarkText      string    `bun:"mark_text"`
	ChapterName   *string   `bun:"chapter_name"`
	ChapterIdx    *int      `bun:"chapter_idx"`
	Style         *int      `bun:"style"`
	CreateTime    *int64    `bun:"create_time"`
	BookmarkID    *string   `bun:"bookmark_id"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (b *BookmarkRow) ToAPIDict() map[string]any {
	return map[string]any{
		"platform_id":  b.PlatformID,
		"book_id":      b.BookID,
		"book_title":   b.BookTitle,
		"mark_text":    b.MarkText,
		"chapter_name": b.ChapterName,
		"chapter_idx":  b.ChapterIdx,
		"style":        b.Style,
		"create_time":  b.CreateTime,
		"bookmark_id":  b.BookmarkID,
	}
}

type NoteRow struct {
	bun.BaseModel `bun:"table:notes"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	Title         string    `bun:"title"`
	URL           *string   `bun:"url"`
	Date          *string   `bun:"date"`
	Location      *string   `bun:"location"`
	Body          *string   `bun:"body"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (n *NoteRow) ToAPIDict() map[string]any {
	return map[string]any{
		"title":    n.Title,
		"url":      n.URL,
		"date":     n.Date,
		"location": n.Location,
		"body":     n.Body,
	}
}
