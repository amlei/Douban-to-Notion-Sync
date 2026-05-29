package flomo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/flomomemo"

	platform "github.com/lifeink-ai/backend/pkg/community/pagination"
)

const PlatformFlomo = 3

type FlomoRepo struct {
	client *ent.Client
	db     *sql.DB
}

func NewFlomoRepo(client *ent.Client, db *sql.DB) *FlomoRepo {
	return &FlomoRepo{client: client, db: db}
}

func (r *FlomoRepo) UpsertFlomoMemos(ctx context.Context, userID int64, items []map[string]any) (map[string]int, error) {
	result := map[string]int{"total": len(items), "updated": 0, "unchanged": 0}

	existing, err := r.client.FlomoMemo.Query().
		Where(flomomemo.UserIDEQ(userID), flomomemo.PlatformIDEQ(PlatformFlomo)).
		All(ctx)
	if err != nil {
		existing = []*ent.FlomoMemo{}
	}
	existingMap := map[string]*ent.FlomoMemo{}
	for _, m := range existing {
		existingMap[m.MemoCreatedAt] = m
	}

	for _, item := range items {
		content := fmt.Sprintf("%v", item["content"])
		memoCreatedAt := fmt.Sprintf("%v", item["memo_created_at"])
		tags := getJSONStr(item, "tags")
		files := getJSONStr(item, "files")

		if ex, ok := existingMap[memoCreatedAt]; ok {
			contentMatch := ex.Content == content
			tagsMatch := strPtrEqual(ex.Tags, tags)
			filesMatch := strPtrEqual(ex.Files, files)
			if contentMatch && tagsMatch && filesMatch {
				result["unchanged"]++
				continue
			}
		}

		_, err := r.db.ExecContext(ctx, `
			INSERT INTO flomo_memos (user_id, platform_id, content, tags, files, memo_created_at, updated_at, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (user_id, platform_id, memo_created_at) DO UPDATE SET
				content = EXCLUDED.content, tags = EXCLUDED.tags, files = EXCLUDED.files`,
			userID, PlatformFlomo, content, tags, files, memoCreatedAt,
			time.Now(), time.Now(),
		)
		if err != nil {
			return result, err
		}
		result["updated"]++
	}
	return result, nil
}

func (r *FlomoRepo) GetFlomoMemos(ctx context.Context, userID int64) ([]*ent.FlomoMemo, error) {
	return r.client.FlomoMemo.Query().
		Where(flomomemo.UserIDEQ(userID)).
		All(ctx)
}

// GetPaginatedMemos returns a paginated, filtered, sorted list of memos.
func (r *FlomoRepo) GetPaginatedMemos(
	ctx context.Context,
	userID int64,
	req platform.PaginationRequest,
) (*platform.PaginatedResponse, error) {
	query := r.client.FlomoMemo.Query().Where(flomomemo.UserIDEQ(userID))

	if req.Keyword != "" {
		query = query.Where(flomomemo.ContentContainsFold(req.Keyword))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, err
	}

	query = query.Order(memoOrderBy(req.SortBy, req.SortOrder)).
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize)

	memos, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, len(memos))
	for i, m := range memos {
		items[i] = FlomoMemoToAPIDict(m)
	}

	return &platform.PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: (total + req.PageSize - 1) / req.PageSize,
	}, nil
}

func memoOrderBy(sortBy, sortOrder string) flomomemo.OrderOption {
	dir := entsql.OrderDesc()
	if sortOrder == "asc" {
		dir = entsql.OrderAsc()
	}
	switch sortBy {
	case "memo_created_at":
		return flomomemo.ByMemoCreatedAt(dir)
	default:
		return flomomemo.ByMemoCreatedAt(dir)
	}
}
