package platform

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/book"
	"github.com/lifeink-ai/backend/ent/conv"
	"github.com/lifeink-ai/backend/ent/communitymeta"
	"github.com/lifeink-ai/backend/pkg/community/pagination"
)

type CommunityMetaRepo struct {
	client *ent.Client
}

func NewCommunityMetaRepo(client *ent.Client) *CommunityMetaRepo {
	return &CommunityMetaRepo{client: client}
}

func (r *CommunityMetaRepo) GetBinding(ctx context.Context, userID int64, platformID int) (*ent.CommunityMeta, error) {
	return r.client.CommunityMeta.Query().
		Where(
			communitymeta.UserIDEQ(userID),
			communitymeta.PlatformIDEQ(platformID),
		).
		Only(ctx)
}

func (r *CommunityMetaRepo) SaveBinding(ctx context.Context, userID int64, platformID int, communityUserID string, profile any) (*ent.CommunityMeta, error) {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return nil, err
	}
	profileStr := string(profileJSON)

	existing, err := r.GetBinding(ctx, userID, platformID)
	if err == nil && existing != nil {
		return r.client.CommunityMeta.UpdateOneID(existing.ID).
			SetBound(1).
			SetCommunityUserID(communityUserID).
			SetProfileJSON(profileStr).
			Save(ctx)
	}

	return r.client.CommunityMeta.Create().
		SetUserID(userID).
		SetPlatformID(platformID).
		SetBound(1).
		SetCommunityUserID(communityUserID).
		SetProfileJSON(profileStr).
		SetCreatedAt(time.Now()).
		SetUpdatedAt(time.Now()).
		Save(ctx)
}

func (r *CommunityMetaRepo) DeleteBinding(ctx context.Context, userID int64, platformID int) error {
	_, err := r.client.CommunityMeta.Delete().
		Where(
			communitymeta.UserIDEQ(userID),
			communitymeta.PlatformIDEQ(platformID),
		).
		Exec(ctx)
	return err
}

func (r *CommunityMetaRepo) SaveSessionState(ctx context.Context, userID int64, platformID int, stateJSON string, expiresAt *string) error {
	meta, err := r.GetBinding(ctx, userID, platformID)
	if err != nil || meta == nil {
		return err
	}
	return r.client.CommunityMeta.UpdateOneID(meta.ID).
		SetSessionStateJSON(stateJSON).
		SetNillableSessionExpiresAt(expiresAt).
		Exec(ctx)
}

func (r *CommunityMetaRepo) GetSessionState(ctx context.Context, userID int64, platformID int) (string, error) {
	meta, err := r.GetBinding(ctx, userID, platformID)
	if err != nil || meta == nil {
		return "", err
	}
	if meta.SessionStateJSON != nil {
		return *meta.SessionStateJSON, nil
	}
	return "", nil
}

// DataRepo handles shared book data operations.
type DataRepo struct {
	client *ent.Client
	db     *sql.DB
}

func NewDataRepo(client *ent.Client, db *sql.DB) *DataRepo {
	return &DataRepo{client: client, db: db}
}

// UpsertBooks inserts or updates Douban books.
func (r *DataRepo) UpsertBooks(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		title := fmt.Sprintf("%v", item["title"])
		url := fmt.Sprintf("%v", item["url"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO books (user_id, platform_id, title, url, cover, author, country, translator, publisher, pub_date, price, rating, read_date, status, tags, comment, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
			ON CONFLICT (user_id, url, platform_id) DO UPDATE SET
				title = EXCLUDED.title, cover = EXCLUDED.cover, author = EXCLUDED.author,
				country = EXCLUDED.country, translator = EXCLUDED.translator, publisher = EXCLUDED.publisher,
				pub_date = EXCLUDED.pub_date, price = EXCLUDED.price, rating = EXCLUDED.rating,
				read_date = EXCLUDED.read_date, status = EXCLUDED.status, tags = EXCLUDED.tags, comment = EXCLUDED.comment`,
			userID, PlatformDouban, title, url,
			getStr(item, "cover"), getStr(item, "author"), getStr(item, "country"),
			getStr(item, "translator"), getStr(item, "publisher"), getStr(item, "pub_date"),
			getStr(item, "price"), getInt(item, "rating"), getStr(item, "read_date"),
			getStr(item, "status"), getJSONStr(item, "tags"), getStr(item, "comment"),
			time.Now(),
		)
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

	existing, err := r.client.Book.Query().
		Where(book.UserIDEQ(userID), book.PlatformIDEQ(PlatformWeread)).
		All(ctx)
	if err != nil {
		existing = []*ent.Book{}
	}
	existingMap := map[string]*ent.Book{}
	for _, b := range existing {
		existingMap[b.URL] = b
	}

	for _, item := range items {
		title := fmt.Sprintf("%v", item["title"])
		url := fmt.Sprintf("%v", item["url"])

		// Build a temporary Book-like struct for hash comparison
		tmpStatus := getStr(item, "status")
		tmpRating := getInt(item, "rating")
		tmpExternal := getJSONStr(item, "external")
		tmpBook := &ent.Book{Status: tmpStatus, Rating: tmpRating, External: tmpExternal}

		if ex, ok := existingMap[url]; ok {
			if conv.BookChangeHash(ex) == conv.BookChangeHash(tmpBook) {
				result["unchanged"]++
				continue
			}
		}

		_, err := r.db.ExecContext(ctx, `
			INSERT INTO books (user_id, platform_id, title, url, cover, author, translator, publisher, price, rating, status, external, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (user_id, url, platform_id) DO UPDATE SET
				title = EXCLUDED.title, cover = EXCLUDED.cover, author = EXCLUDED.author,
				translator = EXCLUDED.translator, publisher = EXCLUDED.publisher, price = EXCLUDED.price,
				rating = EXCLUDED.rating, status = EXCLUDED.status, external = EXCLUDED.external`,
			userID, PlatformWeread, title, url,
			getStr(item, "cover"), getStr(item, "author"),
			getStr(item, "translator"), getStr(item, "publisher"), getStr(item, "price"),
			getInt(item, "rating"), getStr(item, "status"), getJSONStr(item, "external"),
			time.Now(),
		)
		if err != nil {
			return result, err
		}
		result["updated"]++
	}
	return result, nil
}

func (r *DataRepo) GetBooks(ctx context.Context, userID int64) ([]*ent.Book, error) {
	return r.client.Book.Query().
		Where(book.UserIDEQ(userID)).
		All(ctx)
}

func (r *DataRepo) GetBookmarkSynckeys(ctx context.Context, userID int64) (map[string]int, error) {
	books, err := r.client.Book.Query().
		Where(book.UserIDEQ(userID), book.PlatformIDEQ(PlatformWeread)).
		All(ctx)
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

func (r *DataRepo) UpdateBookmarkSynckey(ctx context.Context, userID int64, bookID string, synckey int) error {
	b, err := r.client.Book.Query().
		Where(
			book.UserIDEQ(userID),
			book.PlatformIDEQ(PlatformWeread),
			book.URLEQ(bookID),
		).
		Only(ctx)
	if err != nil {
		return err
	}
	var ext map[string]any
	if b.External != nil {
		json.Unmarshal([]byte(*b.External), &ext)
	}
	if ext == nil {
		ext = map[string]any{}
	}
	ext["bookmark_synckey"] = synckey
	extJSON, _ := json.Marshal(ext)
	extStr := string(extJSON)
	return r.client.Book.UpdateOneID(b.ID).
		SetExternal(extStr).
		Exec(ctx)
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

// CountBooks returns the number of books for a user filtered by platform.
func (r *DataRepo) CountBooks(ctx context.Context, userID int64, platformID int) (int, error) {
	return r.client.Book.Query().
		Where(book.UserIDEQ(userID), book.PlatformIDEQ(platformID)).
		Count(ctx)
}

// GetPaginatedBooks returns a paginated, filtered, sorted list of books.
func (r *DataRepo) GetPaginatedBooks(
	ctx context.Context,
	userID int64,
	req pagination.PaginationRequest,
	filter pagination.BookFilter,
) (*pagination.PaginatedResponse, error) {
	query := r.client.Book.Query().Where(book.UserIDEQ(userID))

	if filter.PlatformID != nil {
		query = query.Where(book.PlatformIDEQ(*filter.PlatformID))
	}
	if filter.Status != "" {
		query = query.Where(book.StatusEQ(filter.Status))
	}
	if req.Keyword != "" {
		query = query.Where(
			book.Or(
				book.TitleContainsFold(req.Keyword),
				book.AuthorContainsFold(req.Keyword),
				book.PublisherContainsFold(req.Keyword),
			),
		)
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, err
	}

	query = query.Order(bookOrderBy(req.SortBy, req.SortOrder)).
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize)

	books, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, len(books))
	for i, b := range books {
		items[i] = conv.BookToAPIDict(b)
	}

	return &pagination.PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: (total + req.PageSize - 1) / req.PageSize,
	}, nil
}

func bookOrderBy(sortBy, sortOrder string) book.OrderOption {
	dir := entsql.OrderDesc()
	if sortOrder == "asc" {
		dir = entsql.OrderAsc()
	}
	switch sortBy {
	case "title":
		return book.ByTitle(dir)
	case "rating":
		return book.ByRating(dir)
	case "read_date":
		return book.ByReadDate(dir)
	default:
		return book.ByScrapedAt(dir)
	}
}

