package flomo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/flomomemo"
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
