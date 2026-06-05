package weread

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/bookmark"
	"github.com/lifeink-ai/backend/ent/note"

	platform "github.com/lifeink-ai/backend/pkg/community/pagination"
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
			INSERT INTO notes (user_id, platform_id, title, url, date, location, body, book_id, abstract, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (user_id, url) DO UPDATE SET
				platform_id = EXCLUDED.platform_id, title = EXCLUDED.title, date = EXCLUDED.date, location = EXCLUDED.location, body = EXCLUDED.body,
				book_id = EXCLUDED.book_id, abstract = EXCLUDED.abstract`,
			userID, PlatformWeread, title,
			getStr(item, "url"), getStr(item, "date"),
			getStr(item, "location"), getStr(item, "body"),
			getStr(item, "book_id"),
			getStr(item, "abstract"),
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

// CountNotes returns the total number of notes for a user.
func (r *WereadRepo) CountNotes(ctx context.Context, userID int64) (int, error) {
	return r.client.Note.Query().Where(note.UserIDEQ(userID)).Count(ctx)
}

// CountBookmarks returns the total number of bookmarks for a user.
func (r *WereadRepo) CountBookmarks(ctx context.Context, userID int64) (int, error) {
	return r.client.Bookmark.Query().Where(bookmark.UserIDEQ(userID)).Count(ctx)
}

// GetPaginatedNotes returns a paginated, filtered, sorted list of notes.
func (r *WereadRepo) GetPaginatedNotes(
	ctx context.Context,
	userID int64,
	req platform.PaginationRequest,
	filter platform.BookmarkNoteFilter,
) (*platform.PaginatedResponse, error) {
	query := r.client.Note.Query().Where(note.UserIDEQ(userID))

	if filter.BookID != "" {
		query = query.Where(note.BookIDEQ(filter.BookID))
	}

	if req.Keyword != "" {
		query = query.Where(note.TitleContainsFold(req.Keyword))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, err
	}

	query = query.Order(noteOrderBy(req.SortBy, req.SortOrder)).
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize)

	notes, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, len(notes))
	for i, n := range notes {
		items[i] = NoteToAPIDict(n)
	}

	return &platform.PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: (total + req.PageSize - 1) / req.PageSize,
	}, nil
}

func noteOrderBy(sortBy, sortOrder string) note.OrderOption {
	dir := entsql.OrderDesc()
	if sortOrder == "asc" {
		dir = entsql.OrderAsc()
	}
	switch sortBy {
	case "title":
		return note.ByTitle(dir)
	case "date":
		return note.ByDate(dir)
	default:
		return note.ByScrapedAt(dir)
	}
}

// GetPaginatedBookmarks returns a paginated, filtered, sorted list of bookmarks.
func (r *WereadRepo) GetPaginatedBookmarks(
	ctx context.Context,
	userID int64,
	req platform.PaginationRequest,
	filter platform.BookmarkNoteFilter,
) (*platform.PaginatedResponse, error) {
	query := r.client.Bookmark.Query().Where(bookmark.UserIDEQ(userID))

	if filter.BookID != "" {
		query = query.Where(bookmark.BookIDEQ(filter.BookID))
	}
	if req.Keyword != "" {
		query = query.Where(
			bookmark.Or(
				bookmark.MarkTextContainsFold(req.Keyword),
				bookmark.BookTitleContainsFold(req.Keyword),
			),
		)
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, err
	}

	query = query.Order(bookmarkOrderBy(req.SortBy, req.SortOrder)).
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize)

	bookmarks, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, len(bookmarks))
	for i, b := range bookmarks {
		items[i] = BookmarkToAPIDict(b)
	}

	return &platform.PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: (total + req.PageSize - 1) / req.PageSize,
	}, nil
}

func bookmarkOrderBy(sortBy, sortOrder string) bookmark.OrderOption {
	dir := entsql.OrderDesc()
	if sortOrder == "asc" {
		dir = entsql.OrderAsc()
	}
	switch sortBy {
	case "book_title":
		return bookmark.ByBookTitle(dir)
	case "create_time":
		return bookmark.ByCreateTime(dir)
	default:
		return bookmark.ByCreateTime(dir)
	}
}
