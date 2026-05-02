package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/uptrace/bun"

	"github.com/lifeink-ai/backend/internal/task"
	"github.com/lifeink-ai/backend/pkg/auth"
	"github.com/lifeink-ai/backend/pkg/data"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// DB is injected from main.go to avoid circular imports.
var DB *bun.DB

type WebSocketHandler struct {
	taskMgr *task.TaskManager
}

func NewWebSocketHandler(taskMgr *task.TaskManager, db *bun.DB) *WebSocketHandler {
	DB = db
	return &WebSocketHandler{taskMgr: taskMgr}
}

func (h *WebSocketHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/api/community/ws", h.handle)
}

func (h *WebSocketHandler) handle(c *gin.Context) {
	platform := c.Query("platform")

	// Auth via subprotocol
	subprotocols := websocket.Subprotocols(c.Request)
	token := ""
	if len(subprotocols) > 0 {
		token = subprotocols[0]
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Missing token"})
		return
	}

	claims, err := auth.DecodeAccessToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
		return
	}

	pkFloat, ok := claims["pk"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
		return
	}
	pk := int64(pkFloat)

	// Upgrade WebSocket with subprotocol
	responseHeader := http.Header{}
	responseHeader.Set("Sec-WebSocket-Protocol", token)
	conn, err := upgrader.Upgrade(c.Writer, c.Request, responseHeader)
	if err != nil {
		return
	}
	defer conn.Close()

	// Validate user
	ctx := c.Request.Context()
	user := &data.User{}
	err = DB.NewSelect().Model(user).Where("id = ? AND status = 'active'", pk).Scan(ctx)
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4001, "auth failure"))
		return
	}

	if !isSupportedPlatform(platform) {
		writeJSON(conn, map[string]any{"status": "failed", "error": "Unsupported platform: " + platform})
		return
	}

	// Message loop - poll task status
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[ws] panic: %v", r)
			conn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(1011, "internal error"))
		}
	}()

	for {
		t := h.taskMgr.GetTask(user.ID, platform)
		if t == nil {
			writeJSON(conn, map[string]any{"status": "idle"})
			time.Sleep(1 * time.Second)
			continue
		}

		result := map[string]any{"status": t.Status}
		if t.QRBase64 != "" {
			result["qr_base64"] = t.QRBase64
		}
		if t.Status == "scraping" {
			result["scrape_phase"] = t.ScrapePhase
			result["scrape_counts"] = t.ScrapeCounts
		}
		if t.Status == "bound" {
			result["user_id"] = t.UserID
			result["profile"] = t.Profile
			result["scrape_counts"] = t.ScrapeCounts
		}
		if t.Status == "failed" {
			result["error"] = t.Error
		}

		if err := writeJSON(conn, result); err != nil {
			return
		}

		if t.Status == "bound" || t.Status == "failed" {
			return
		}

		// Wait for task notification or timeout
		select {
		case <-t.Wait():
		case <-time.After(30 * time.Second):
			// Send keepalive
		}
	}
}

func writeJSON(conn *websocket.Conn, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, data)
}

func isSupportedPlatform(platform string) bool {
	for _, p := range data.SupportedPlatforms() {
		if p == platform {
			return true
		}
	}
	return false
}
