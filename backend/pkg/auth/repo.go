package auth

import (
	"context"
	"time"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/user"
)

type AuthRepo struct {
	client *ent.Client
}

func NewAuthRepo(client *ent.Client) *AuthRepo {
	return &AuthRepo{client: client}
}

func (r *AuthRepo) GetActiveUserByEmail(ctx context.Context, email string) (*ent.User, error) {
	return r.client.User.Query().
		Where(
			user.EmailEQ(email),
			user.StatusEQ("active"),
		).
		Only(ctx)
}

func (r *AuthRepo) GetDeletedUserByEmail(ctx context.Context, email string) (*ent.User, error) {
	return r.client.User.Query().
		Where(
			user.EmailEQ(email),
			user.StatusEQ("deleted"),
		).
		Only(ctx)
}

func (r *AuthRepo) GetUserByPK(ctx context.Context, pk int64) (*ent.User, error) {
	return r.client.User.Get(ctx, pk)
}

func (r *AuthRepo) CreateUser(ctx context.Context, email, password string) (*ent.User, error) {
	uid := GenerateUserID()
	name := "星迹 " + uid
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	// Check for deleted user to reuse
	deleted, err := r.GetDeletedUserByEmail(ctx, email)
	if err == nil && deleted != nil {
		updated, err := r.client.User.UpdateOneID(deleted.ID).
			SetUserID(uid).
			SetPasswordHash(hash).
			SetName(name).
			SetStatus("active").
			SetEmailVerified(true).
			SetUpdatedAt(now).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		return updated, nil
	}

	return r.client.User.Create().
		SetUserID(uid).
		SetEmail(email).
		SetPasswordHash(hash).
		SetName(name).
		SetStatus("active").
		SetEmailVerified(true).
		SetCreatedAt(now).
		SetUpdatedAt(now).
		Save(ctx)
}

func (r *AuthRepo) UpdateProfile(ctx context.Context, u *ent.User, name, avatar, bio *string) (*ent.User, error) {
	update := r.client.User.UpdateOneID(u.ID)
	if name != nil {
		update = update.SetName(*name)
	}
	if avatar != nil {
		update = update.SetAvatar(*avatar)
	}
	if bio != nil {
		update = update.SetBio(*bio)
	}
	return update.SetUpdatedAt(time.Now()).Save(ctx)
}

func (r *AuthRepo) UpdatePassword(ctx context.Context, u *ent.User, newPassword string) error {
	hash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	return r.client.User.UpdateOneID(u.ID).
		SetPasswordHash(hash).
		SetUpdatedAt(time.Now()).
		Exec(context.Background())
}

func (r *AuthRepo) SoftDelete(ctx context.Context, u *ent.User) error {
	return r.client.User.UpdateOneID(u.ID).
		SetStatus("deleted").
		SetUpdatedAt(time.Now()).
		Exec(context.Background())
}
