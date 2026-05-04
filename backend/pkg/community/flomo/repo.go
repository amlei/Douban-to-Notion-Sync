package flomo

import (
	"context"

	"github.com/uptrace/bun"
)

const PlatformFlomo = 3

type FlomoRepo struct {
	db *bun.DB
}

func NewFlomoRepo(db *bun.DB) *FlomoRepo {
	return &FlomoRepo{db: db}
}

func (r *FlomoRepo) UpsertFlomoMemos(ctx context.Context, userID int64, items []map[string]any) (map[string]int, error) {
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
		memo := memoRowFromMap(item)
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

func (r *FlomoRepo) GetFlomoMemos(ctx context.Context, userID int64) ([]FlomoMemoRow, error) {
	var memos []FlomoMemoRow
	err := r.db.NewSelect().Model(&memos).Where("user_id = ?", userID).Scan(ctx)
	return memos, err
}
