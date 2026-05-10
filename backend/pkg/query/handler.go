package query

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lifeink-ai/backend/community/openai"
)

type QueryHandler struct {
	client *openai.Client
}

func NewQueryHandler(client *openai.Client) *QueryHandler {
	return &QueryHandler{client: client}
}

func (h *QueryHandler) RegisterRoutes(r *gin.Engine) {
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

func (h *QueryHandler) handle(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(400, "Invalid request body")
		return
	}

	// Convert messages to openai.Message, supporting both content and parts formats.
	msgs := make([]openai.Message, 0, len(req.Messages))
	for _, m := range req.Messages {
		content := m.Content
		if content == "" {
			for _, part := range m.Parts {
				if part.Type == "text" {
					content = part.Text
					break
				}
			}
		}
		if content == "" {
			continue
		}
		msgs = append(msgs, openai.Message{
			Role:    m.Role,
			Content: content,
		})
	}

	if len(msgs) == 0 {
		c.String(400, "No messages provided")
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")

	textID := "txt-0"
	reasoningID := "rsn-0"
	reasoningStarted := false
	textStarted := false

	// Lazily send text-start on first text delta.
	ensureTextStarted := func() {
		if !textStarted {
			chunk, _ := json.Marshal(map[string]string{
				"type": "text-start",
				"id":   textID,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
			c.Writer.Flush()
			textStarted = true
		}
	}

	// Close reasoning part if still open when text starts.
	ensureReasoningClosed := func() {
		if reasoningStarted {
			chunk, _ := json.Marshal(map[string]string{
				"type": "reasoning-end",
				"id":   reasoningID,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
			c.Writer.Flush()
			reasoningStarted = false
		}
	}

	err := h.client.ChatStream(c.Request.Context(), msgs,
		func(delta string) {
			ensureReasoningClosed()
			ensureTextStarted()
			chunk, _ := json.Marshal(map[string]string{
				"type":  "text-delta",
				"id":    textID,
				"delta": delta,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
			c.Writer.Flush()
		},
		func(reasoning string) {
			if !reasoningStarted {
				startChunk, _ := json.Marshal(map[string]string{
					"type": "reasoning-start",
					"id":   reasoningID,
				})
				fmt.Fprintf(c.Writer, "data: %s\n\n", startChunk)
				c.Writer.Flush()
				reasoningStarted = true
			}
			chunk, _ := json.Marshal(map[string]string{
				"type":  "reasoning-delta",
				"id":    reasoningID,
				"delta": reasoning,
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
			c.Writer.Flush()
		},
	)
	if err != nil {
		if !c.Writer.Written() {
			c.Status(http.StatusInternalServerError)
			chunk, _ := json.Marshal(map[string]string{
				"type":      "error",
				"errorText": err.Error(),
			})
			fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
			c.Writer.Flush()
		}
		return
	}

	// Close any remaining open parts.
	ensureReasoningClosed()
	if textStarted {
		chunk, _ := json.Marshal(map[string]string{
			"type": "text-end",
			"id":   textID,
		})
		fmt.Fprintf(c.Writer, "data: %s\n\n", chunk)
		c.Writer.Flush()
	}
}
