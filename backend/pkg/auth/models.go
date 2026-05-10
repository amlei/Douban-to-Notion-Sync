package auth

import (
	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/ent"
)

func GetUser(c *gin.Context) *ent.User {
	u, exists := c.Get("user")
	if !exists {
		return nil
	}
	return u.(*ent.User)
}

func SetUser(c *gin.Context, user *ent.User) {
	c.Set("user", user)
}
