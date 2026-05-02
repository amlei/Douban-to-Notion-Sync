package chat

import (
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
)

type ChatHandler struct{}

func NewChatHandler() *ChatHandler {
	return &ChatHandler{}
}

func (h *ChatHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/api/chat", h.handle)
}

type chatPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type chatMessage struct {
	Role    string     `json:"role"`
	Content string     `json:"content"`
	Parts   []chatPart `json:"parts"`
}

type chatRequest struct {
	Messages []chatMessage `json:"messages"`
}

func (h *ChatHandler) handle(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(400, "Invalid request body")
		return
	}

	// Find last user message
	lastUserMsg := ""
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			for _, part := range req.Messages[i].Parts {
				if part.Type == "text" {
					lastUserMsg = part.Text
					break
				}
			}
			if lastUserMsg == "" {
				lastUserMsg = req.Messages[i].Content
			}
			break
		}
	}

	response := fmt.Sprintf("You said: %s\n\nThis is a mock response from the LifeInk AI backend. Replace this with your LLM provider integration.", lastUserMsg)

	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Transfer-Encoding", "chunked")

	for _, char := range response {
		c.Writer.WriteString(string(char))
		c.Writer.Flush()
		time.Sleep(20 * time.Millisecond)
	}
}
