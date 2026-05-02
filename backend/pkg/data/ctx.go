package data

import "github.com/gin-gonic/gin"

// GetUser retrieves the authenticated user from gin context.
func GetUser(c *gin.Context) *User {
	u, exists := c.Get("user")
	if !exists {
		return nil
	}
	return u.(*User)
}
