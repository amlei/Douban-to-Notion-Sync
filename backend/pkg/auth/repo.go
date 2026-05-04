package auth

import (
	"context"
	"time"

	"github.com/uptrace/bun"
)

type AuthRepo struct {
	db *bun.DB
}

func NewAuthRepo(db *bun.DB) *AuthRepo {
	return &AuthRepo{db: db}
}

func (r *AuthRepo) GetActiveUserByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{}
	err := r.db.NewSelect().Model(user).
		Where("email = ? AND status = 'active'", email).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *AuthRepo) GetDeletedUserByEmail(ctx context.Context, email string) (*User, error) {
	user := &User{}
	err := r.db.NewSelect().Model(user).
		Where("email = ? AND status = 'deleted'", email).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *AuthRepo) GetUserByPK(ctx context.Context, pk int64) (*User, error) {
	user := &User{}
	err := r.db.NewSelect().Model(user).
		Where("id = ?", pk).
		Scan(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *AuthRepo) CreateUser(ctx context.Context, email, password string) (*User, error) {
	uid := GenerateUserID()
	name := "星迹 " + uid
	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	// Check for deleted user to reuse
	deleted, err := r.GetDeletedUserByEmail(ctx, email)
	if err == nil && deleted != nil {
		deleted.UserID = uid
		deleted.PasswordHash = hash
		deleted.Name = name
		deleted.Status = "active"
		deleted.EmailVerified = true
		deleted.UpdatedAt = time.Now()
		_, err = r.db.NewUpdate().Model(deleted).WherePK().Exec(ctx)
		if err != nil {
			return nil, err
		}
		return deleted, nil
	}

	user := &User{
		UserID:        uid,
		Email:         email,
		PasswordHash:  hash,
		Name:          name,
		Status:        "active",
		EmailVerified: true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	_, err = r.db.NewInsert().Model(user).Exec(ctx)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *AuthRepo) UpdateProfile(ctx context.Context, user *User, name, avatar, bio *string) (*User, error) {
	if name != nil {
		user.Name = *name
	}
	if avatar != nil {
		user.Avatar = avatar
	}
	if bio != nil {
		user.Bio = bio
	}
	user.UpdatedAt = time.Now()
	_, err := r.db.NewUpdate().Model(user).WherePK().Exec(ctx)
	return user, err
}

func (r *AuthRepo) UpdatePassword(ctx context.Context, user *User, newPassword string) error {
	hash, err := HashPassword(newPassword)
	if err != nil {
		return err
	}
	user.PasswordHash = hash
	user.UpdatedAt = time.Now()
	_, err = r.db.NewUpdate().Model(user).WherePK().Exec(ctx)
	return err
}

func (r *AuthRepo) SoftDelete(ctx context.Context, user *User) error {
	user.Status = "deleted"
	user.UpdatedAt = time.Now()
	_, err := r.db.NewUpdate().Model(user).WherePK().Exec(ctx)
	return err
}
