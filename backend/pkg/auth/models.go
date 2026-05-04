package auth

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel  `bun:"table:users"`
	ID             int64     `bun:"id,pk,autoincrement"`
	UserID         string    `bun:"user_id,unique"`
	Email          string    `bun:"email,unique"`
	PasswordHash   string    `bun:"password_hash"`
	Name           string    `bun:"name"`
	Avatar         *string   `bun:"avatar"`
	Bio            *string   `bun:"bio"`
	Status         string    `bun:"status"`
	EmailVerified  bool      `bun:"email_verified"`
	CreatedAt      time.Time `bun:"created_at"`
	UpdatedAt      time.Time `bun:"updated_at"`
}

func (u *User) ToAPIDict() map[string]any {
	return map[string]any{
		"user_id":         u.UserID,
		"email":           u.Email,
		"name":            u.Name,
		"avatar":          u.Avatar,
		"bio":             u.Bio,
		"email_verified":  u.EmailVerified,
		"created_at":      u.CreatedAt.Format("2006-01-02T15:04:05.999999+08:00"),
	}
}

func GetUser(c *gin.Context) *User {
	u, exists := c.Get("user")
	if !exists {
		return nil
	}
	return u.(*User)
}

func SetUser(c *gin.Context, user *User) {
	c.Set("user", user)
}
