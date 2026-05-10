package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/community/openai"
	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/conv"
	"github.com/lifeink-ai/backend/pkg/auth"
)

type ChatHandler struct {
	client *openai.Client
	repo   *ChatRepo
}

func NewChatHandler(client *openai.Client, repo *ChatRepo) *ChatHandler {
	return &ChatHandler{client: client, repo: repo}
}

func (h *ChatHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/api/chat", h.handle)
}

type sendRequest struct {
	Content   string  `json:"content"`
	SessionID *string `json:"session_id,omitempty"`
}

func (h *ChatHandler) handle(c *gin.Context) {
	action := c.Query("action")
	switch action {
	case "list":
		h.listSessions(c)
	case "messages":
		h.getMessages(c)
	case "delete":
		h.deleteSession(c)
	case "rename":
		h.renameSession(c)
	case "batch-delete":
		h.batchDeleteSessions(c)
	case "":
		h.send(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported action: " + action})
	}
}

func (h *ChatHandler) listSessions(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}
	sessions, err := h.repo.ListSessions(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	result := make([]map[string]any, len(sessions))
	for i, s := range sessions {
		result[i] = conv.SessionToAPIDict(s)
	}
	c.JSON(http.StatusOK, result)
}

func (h *ChatHandler) getMessages(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session_id"})
		return
	}
	s, err := h.repo.VerifyOwnership(c.Request.Context(), sessionID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Session not found"})
		return
	}
	messages, err := h.repo.ListMessages(c.Request.Context(), s.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	result := make([]map[string]any, len(messages))
	for i, m := range messages {
		result[i] = conv.MessageToAPIDict(m)
	}
	c.JSON(http.StatusOK, result)
}

func (h *ChatHandler) deleteSession(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session_id"})
		return
	}
	s, err := h.repo.VerifyOwnership(c.Request.Context(), sessionID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Session not found"})
		return
	}
	if err := h.repo.DeleteSession(c.Request.Context(), s.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type renameRequest struct {
	SessionID string `json:"session_id"`
	Title     string `json:"title"`
}

func (h *ChatHandler) renameSession(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}
	var req renameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if req.SessionID == "" || strings.TrimSpace(req.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id and title are required"})
		return
	}
	s, err := h.repo.VerifyOwnership(c.Request.Context(), req.SessionID, user.ID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Session not found"})
		return
	}
	if err := h.repo.UpdateTitle(c.Request.Context(), s.ID, strings.TrimSpace(req.Title)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type batchDeleteRequest struct {
	SessionIDs []string `json:"session_ids"`
}

func (h *ChatHandler) batchDeleteSessions(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}
	var req batchDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	if len(req.SessionIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_ids is required"})
		return
	}
	deleted, err := h.repo.BatchDeleteSessions(c.Request.Context(), user.ID, req.SessionIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "deleted": deleted})
}

func (h *ChatHandler) send(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Not authenticated"})
		return
	}

	var req sendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.String(http.StatusBadRequest, "Invalid request body")
		return
	}
	if strings.TrimSpace(req.Content) == "" {
		c.String(http.StatusBadRequest, "Empty content")
		return
	}

	ctx := c.Request.Context()

	var session *ent.Session
	isNewSession := req.SessionID == nil || *req.SessionID == ""
	if isNewSession {
		var err error
		session, err = h.repo.CreateSession(ctx, user.ID, "")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		var err error
		session, err = h.repo.VerifyOwnership(ctx, *req.SessionID, user.ID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"})
			return
		}
	}

	// Save user message (uses internal bigserial id for FK)
	if _, err := h.repo.SaveMessage(ctx, session.ID, "user", req.Content, nil); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Async title generation for new sessions (runs concurrently with main LLM call)
	if isNewSession {
		go h.generateTitle(session.ID, req.Content)
	}

	// Load full message history for LLM context
	dbMessages, err := h.repo.ListMessages(ctx, session.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	llmMessages := make([]openai.Message, 0, len(dbMessages))
	for _, m := range dbMessages {
		llmMessages = append(llmMessages, openai.Message{
			Role:    m.Role,
			Content: m.Content,
		})
	}

	// Set streaming headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")

	textID := "txt-0"

	// Send session_id as response header (cannot use SSE "data" type -- not in uiMessageChunkSchema)
	c.Header("X-Session-Id", session.SessionID)

	reasoningStarted := false
	textStarted := false

	// Lazily send reasoning-start on first reasoning delta.
	ensureReasoningStarted := func() {
		if !reasoningStarted {
			writeSSE(c, map[string]any{
				"type": "reasoning-start",
				"id":   textID,
			})
			reasoningStarted = true
		}
	}

	// Close reasoning part if still open when text starts.
	ensureReasoningClosed := func() {
		if reasoningStarted {
			writeSSE(c, map[string]any{
				"type": "reasoning-end",
				"id":   textID,
			})
			reasoningStarted = false
		}
	}

	// Lazily send text-start on first text delta.
	ensureTextStarted := func() {
		if !textStarted {
			ensureReasoningClosed()
			writeSSE(c, map[string]any{
				"type": "text-start",
				"id":   textID,
			})
			textStarted = true
		}
	}

	// Stream LLM response
	var contentBuf strings.Builder
	var reasoningBuf strings.Builder

	log.Printf("[chat] Calling LLM with %d messages", len(llmMessages))
	streamErr := h.client.ChatStream(ctx, llmMessages,
		func(delta string) {
			contentBuf.WriteString(delta)
			ensureTextStarted()
			writeSSE(c, map[string]any{
				"type":  "text-delta",
				"id":    textID,
				"delta": delta,
			})
		},
		func(reasoning string) {
			reasoningBuf.WriteString(reasoning)
			ensureReasoningStarted()
			writeSSE(c, map[string]any{
				"type":  "reasoning-delta",
				"id":    textID,
				"delta": reasoning,
			})
		},
	)

	if streamErr != nil {
		log.Printf("[chat] LLM stream error: %v", streamErr)
		writeSSE(c, map[string]any{
			"type":      "error",
			"errorText": streamErr.Error(),
		})
		return
	}

	// Close any remaining open parts
	ensureReasoningClosed()
	if textStarted {
		writeSSE(c, map[string]any{
			"type": "text-end",
			"id":   textID,
		})
	}

	log.Printf("[chat] Stream completed, content=%d bytes, reasoning=%d bytes", contentBuf.Len(), reasoningBuf.Len())

	// Save assistant message to DB
	var reasoningPtr *string
	reasoningStr := reasoningBuf.String()
	if reasoningStr != "" {
		reasoningPtr = &reasoningStr
	}
	h.repo.SaveMessage(ctx, session.ID, "assistant", contentBuf.String(), reasoningPtr)

	// Send finish
	writeSSE(c, map[string]any{
		"type":         "finish",
		"finishReason": "stop",
	})
}

func (h *ChatHandler) generateTitle(id int64, userMessage string) {
	titlePrompt := []openai.Message{
		{Role: "system", Content: "Generate a concise title (max 30 characters, in Chinese) for this conversation. Only output the title text, nothing else."},
		{Role: "user", Content: userMessage},
	}
	resp, err := h.client.Chat(context.Background(), titlePrompt)
	if err != nil {
		return
	}
	if len(resp.Choices) == 0 {
		return
	}
	title := strings.TrimSpace(resp.Choices[0].Message.Content)
	if title == "" {
		return
	}
	// Truncate to 30 characters (runes)
	runes := []rune(title)
	if len(runes) > 30 {
		title = string(runes[:30])
	}
	_ = h.repo.UpdateTitle(context.Background(), id, title)
}

func writeSSE(c *gin.Context, v map[string]any) {
	b, _ := json.Marshal(v)
	c.Writer.Write([]byte("data: "))
	c.Writer.Write(b)
	c.Writer.Write([]byte("\n\n"))
	c.Writer.Flush()
}
