package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/pkg/auth"
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

		// Validate token: cookie first, then Bearer header
		tokenStr := ""
		if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
			tokenStr = cookie
		} else {
			header := c.GetHeader("Authorization")
			if strings.HasPrefix(header, "Bearer ") {
				tokenStr = header[7:]
			}
		}

		if tokenStr == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Missing token"})
			c.Abort()
			return
		}

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

		user := &auth.User{}
		err = database.DB.NewSelect().Model(user).Where("id = ?", pk).Scan(c.Request.Context())
		if err != nil || user.Status != "active" {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "User not found"})
			c.Abort()
			return
		}

		auth.SetUser(c, user)
		c.Next()
	}
}

func CORSMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]bool{
		"http://localhost:3000":  true,
		"http://localhost:5173":  true,
		"http://127.0.0.1:3000": true,
		"http://127.0.0.1:5173": true,
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowedOrigins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}
		c.Header("Access-Control-Allow-Methods", "*")
		c.Header("Access-Control-Allow-Headers", "*")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}