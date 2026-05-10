package platform

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/pkg/auth"
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
		taskID, err := h.svc.StartBind(ctx, user.ID, platform, channel)
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
	platform := c.DefaultQuery("platform", "all")
	if platform != "all" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Use platform=all to fetch all platform data"})
		return
	}

	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}

	result, err := h.svc.GetCommunityData(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
