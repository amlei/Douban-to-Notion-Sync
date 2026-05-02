package community

import (
	"context"
	"encoding/json"

	"github.com/uptrace/bun"

	"github.com/lifeink-ai/backend/pkg/data"
)

type CommunityMetaRepo struct {
	db *bun.DB
}

func NewCommunityMetaRepo(db *bun.DB) *CommunityMetaRepo {
	return &CommunityMetaRepo{db: db}
}

func (r *CommunityMetaRepo) GetBinding(ctx context.Context, userID int64, platformID int) (*data.CommunityMeta, error) {
	meta := &data.CommunityMeta{}
	err := r.db.NewSelect().Model(meta).
		Where("user_id = ? AND platform_id = ?", userID, platformID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return meta, nil
}

func (r *CommunityMetaRepo) SaveBinding(ctx context.Context, userID int64, platformID int, communityUserID string, profile any) (*data.CommunityMeta, error) {
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

	meta := &data.CommunityMeta{
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
	_, err := r.db.NewDelete().Model((*data.CommunityMeta)(nil)).
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
