package platform

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/lifeink-ai/backend/internal/ws"
)

type WebSocketHandler struct {
	auth    *ws.Authenticator
	taskMgr *TaskManager
}

func NewWebSocketHandler(auth *ws.Authenticator, taskMgr *TaskManager) *WebSocketHandler {
	return &WebSocketHandler{auth: auth, taskMgr: taskMgr}
}

func (h *WebSocketHandler) RegisterRoutes(r *gin.Engine) {
	r.GET("/api/community/ws", h.handle)
}

func (h *WebSocketHandler) handle(c *gin.Context) {
	platform := c.Query("platform")

	user, conn, err := h.auth.Handshake(c)
	if err != nil {
		return
	}
	defer conn.Close()

	if !isSupportedPlatform(platform) {
		ws.WriteJSON(conn, map[string]any{"status": "failed", "error": "Unsupported platform: " + platform})
		return
	}

	defer func() {
		if r := recover(); r != nil {
			log.Printf("[ws] panic: %v", r)
			conn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(1011, "internal error"))
		}
	}()

	for {
		t := h.taskMgr.Get(user.ID, platform)
		if t == nil {
			ws.WriteJSON(conn, map[string]any{"status": "idle"})
			time.Sleep(1 * time.Second)
			continue
		}

		result := map[string]any{"status": t.Status}
		if t.Data.QRBase64 != "" {
			result["qr_base64"] = t.Data.QRBase64
		}
		if t.Status == "scraping" {
			result["scrape_phase"] = t.Data.ScrapePhase
			result["scrape_counts"] = t.Data.ScrapeCounts
		}
		if t.Status == "bound" {
			result["user_id"] = t.Data.UserID
			result["profile"] = t.Data.Profile
			result["scrape_counts"] = t.Data.ScrapeCounts
		}
		if t.Status == "failed" {
			result["error"] = t.Data.Error
		}

		if err := ws.WriteJSON(conn, result); err != nil {
			return
		}

		if t.Status == "bound" || t.Status == "failed" {
			return
		}

		select {
		case <-t.Wait():
		case <-time.After(30 * time.Second):
		}
	}
}
