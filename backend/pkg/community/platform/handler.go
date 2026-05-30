package platform

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/pkg/auth"
	"github.com/lifeink-ai/backend/pkg/community/pagination"
)

type CommunityHandler struct {
	svc *CommunityService
}

func NewCommunityHandler(svc *CommunityService) *CommunityHandler {
	return &CommunityHandler{svc: svc}
}

func (h *CommunityHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/api/community/bind", h.bind)
	r.POST("/api/community/sync", h.sync)
	r.GET("/api/community/data", h.data)
}

func (h *CommunityHandler) bind(c *gin.Context) {
	action := c.Query("action")
	platform := c.Query("platform")

	if action != "status" && action != "start" && action != "refresh" && action != "delete" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported action: " + action})
		return
	}

	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}

	ctx := c.Request.Context()

	if platform == "all" && action == "status" {
		result, err := h.svc.StatusAll(ctx, user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)
		return
	}

	if !isSupportedPlatform(platform) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported platform: " + platform})
		return
	}

	switch action {
	case "status":
		result, err := h.svc.Status(ctx, user.ID, platform)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)

	case "start":
		channel := "msedge"
		apiKey := ""
		var body struct {
			APIKey string `json:"api_key"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			apiKey = body.APIKey
		}
		log.Printf("[community] start bind: platform=%s, apiKey=%s", platform, func() string {
			if apiKey != "" {
				return apiKey[:8] + "…"
			}
			return "(empty)"
		}())
		taskID, err := h.svc.StartBind(ctx, user.ID, platform, channel, apiKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"task_id": taskID})

	case "refresh":
		result, err := h.svc.Refresh(ctx, user.ID, platform)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)

	case "delete":
		if err := h.svc.Unbind(ctx, user.ID, platform); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"bound": false})
	}
}

func (h *CommunityHandler) sync(c *gin.Context) {
	platform := c.Query("platform")
	if !isSupportedPlatform(platform) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported platform: " + platform})
		return
	}

	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}

	taskID, err := h.svc.StartSync(c.Request.Context(), user.ID, platform)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"task_id": taskID})
}

func (h *CommunityHandler) data(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}

	dataType := c.Query("type")
	if dataType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required parameter: type"})
		return
	}

	var req pagination.PaginationRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Defaults()

	var bookFilter pagination.BookFilter
	if dataType == "books" {
		c.ShouldBindQuery(&bookFilter)
	}

	var bnFilter pagination.BookmarkNoteFilter
	if dataType == "bookmarks" || dataType == "notes" {
		c.ShouldBindQuery(&bnFilter)
	}

	result, err := h.svc.GetPaginatedData(c.Request.Context(), user.ID, dataType, req, bookFilter, bnFilter)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func isSupportedPlatform(platform string) bool {
	for _, p := range SupportedPlatforms() {
		if p == platform {
			return true
		}
	}
	return false
}
