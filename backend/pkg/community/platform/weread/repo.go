package weread

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/bookmark"
	"github.com/lifeink-ai/backend/ent/note"
)

type WereadRepo struct {
	client *ent.Client
	db     *sql.DB
}

func NewWereadRepo(client *ent.Client, db *sql.DB) *WereadRepo {
	return &WereadRepo{client: client, db: db}
}

const PlatformWeread = 2

func (r *WereadRepo) UpsertBookmarks(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		bookID := fmt.Sprintf("%v", item["book_id"])
		markText := fmt.Sprintf("%v", item["mark_text"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO bookmarks (user_id, platform_id, book_id, book_title, mark_text, chapter_name, chapter_idx, style, create_time, bookmark_id, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (user_id, platform_id, book_id, bookmark_id) DO UPDATE SET
				mark_text = EXCLUDED.mark_text, chapter_name = EXCLUDED.chapter_name,
				chapter_idx = EXCLUDED.chapter_idx, style = EXCLUDED.style,
				create_time = EXCLUDED.create_time, book_title = EXCLUDED.book_title`,
			userID, PlatformWeread, bookID,
			getStr(item, "book_title"), markText,
			getStr(item, "chapter_name"), getInt(item, "chapter_idx"),
			getInt(item, "style"), getInt64(item, "create_time"),
			getStr(item, "bookmark_id"),
			time.Now(),
		)
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
		title := fmt.Sprintf("%v", item["title"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO notes (user_id, title, url, date, location, body, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (user_id, url) DO UPDATE SET
				title = EXCLUDED.title, date = EXCLUDED.date, location = EXCLUDED.location, body = EXCLUDED.body`,
			userID, title,
			getStr(item, "url"), getStr(item, "date"),
			getStr(item, "location"), getStr(item, "body"),
			time.Now(),
		)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *WereadRepo) GetBookmarks(ctx context.Context, userID int64) ([]*ent.Bookmark, error) {
	return r.client.Bookmark.Query().
		Where(bookmark.UserIDEQ(userID)).
		All(ctx)
}

func (r *WereadRepo) GetNotes(ctx context.Context, userID int64) ([]*ent.Note, error) {
	return r.client.Note.Query().
		Where(note.UserIDEQ(userID)).
		All(ctx)
}
