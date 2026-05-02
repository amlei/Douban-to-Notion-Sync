package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/pkg/auth"
	"github.com/lifeink-ai/backend/pkg/data"
)

var whitelist = map[string]bool{
	"/api/auth": true,
	"/api/chat": true,
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Whitelist
		if whitelist[path] || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// WebSocket handled in its own handler
		if strings.HasPrefix(path, "/api/community/ws") {
			c.Next()
			return
		}

		// Validate Bearer token
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Missing token"})
			c.Abort()
			return
		}
		tokenStr := header[7:]

		claims, err := auth.DecodeAccessToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
			c.Abort()
			return
		}

		pkFloat, ok := claims["pk"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
			c.Abort()
			return
		}
		pk := int64(pkFloat)

		user := &data.User{}
		err = database.DB.NewSelect().Model(user).Where("id = ?", pk).Scan(c.Request.Context())
		if err != nil || user.Status != "active" {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "User not found"})
			c.Abort()
			return
		}

		SetUser(c, user)
		c.Next()
	}
}

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "*")
		c.Header("Access-Control-Allow-Headers", "*")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// GetUser retrieves the authenticated user from gin context.
// Defined in pkg/data/ctx.go to avoid import cycles.
func SetUser(c *gin.Context, user *data.User) {
	c.Set("user", user)
}
