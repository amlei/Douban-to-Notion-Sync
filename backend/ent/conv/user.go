package conv

import (
	"github.com/lifeink-ai/backend/ent"
)

func UserToAPIDict(u *ent.User) map[string]any {
	return map[string]any{
		"user_id":        u.UserID,
		"email":          u.Email,
		"name":           u.Name,
		"avatar":         u.Avatar,
		"bio":            u.Bio,
		"email_verified": u.EmailVerified,
		"created_at":     u.CreatedAt.Format("2006-01-02T15:04:05.999999+08:00"),
	}
}
