package platform

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/uptrace/bun"
)

type CommunityMetaRepo struct {
	db *bun.DB
}

func NewCommunityMetaRepo(db *bun.DB) *CommunityMetaRepo {
	return &CommunityMetaRepo{db: db}
}

func (r *CommunityMetaRepo) GetBinding(ctx context.Context, userID int64, platformID int) (*CommunityMeta, error) {
	meta := &CommunityMeta{}
	err := r.db.NewSelect().Model(meta).
		Where("user_id = ? AND platform_id = ?", userID, platformID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return meta, nil
}

func (r *CommunityMetaRepo) SaveBinding(ctx context.Context, userID int64, platformID int, communityUserID string, profile any) (*CommunityMeta, error) {
	profileJSON, err := json.Marshal(profile)
	if err != nil {
		return nil, err
	}
	profileStr := string(profileJSON)

	existing, err := r.GetBinding(ctx, userID, platformID)
	if err == nil && existing != nil {
		existing.Bound = 1
		existing.CommunityUserID = &communityUserID
		existing.ProfileJSON = &profileStr
		_, err = r.db.NewUpdate().Model(existing).WherePK().Exec(ctx)
		return existing, err
	}

	meta := &CommunityMeta{
		UserID:          userID,
		PlatformID:      platformID,
		Bound:           1,
		CommunityUserID: &communityUserID,
		ProfileJSON:     &profileStr,
	}
	_, err = r.db.NewInsert().Model(meta).Exec(ctx)
	return meta, err
}

func (r *CommunityMetaRepo) DeleteBinding(ctx context.Context, userID int64, platformID int) error {
	_, err := r.db.NewDelete().Model((*CommunityMeta)(nil)).
		Where("user_id = ? AND platform_id = ?", userID, platformID).
		Exec(ctx)
	return err
}

func (r *CommunityMetaRepo) SaveSessionState(ctx context.Context, userID int64, platformID int, stateJSON string, expiresAt *string) error {
	meta, err := r.GetBinding(ctx, userID, platformID)
	if err != nil || meta == nil {
		return err
	}
	meta.SessionStateJSON = &stateJSON
	meta.SessionExpiresAt = expiresAt
	_, err = r.db.NewUpdate().Model(meta).WherePK().Exec(ctx)
	return err
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

		if ex, ok := existingMap[book.URL]; ok {
			if ex.ChangeHash() == book.ChangeHash() {
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

func (r *DataRepo) GetBooks(ctx context.Context, userID int64) ([]BookRow, error) {
	var books []BookRow
	err := r.db.NewSelect().Model(&books).Where("user_id = ?", userID).Scan(ctx)
	return books, err
}

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

func strPtr(v string) *string   { return &v }
func intPtr(v int) *int         { return &v }
func int64Ptr(v int64) *int64   { return &v }

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
