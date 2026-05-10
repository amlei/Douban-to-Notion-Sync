package auth

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/conv"
	"github.com/lifeink-ai/backend/internal/database"
)

type AuthHandler struct {
	repo *AuthRepo
}

func NewAuthHandler(client *ent.Client) *AuthHandler {
	return &AuthHandler{repo: NewAuthRepo(client)}
}

type authRequest struct {
	Action       string  `json:"action"`
	Email        *string `json:"email"`
	Password     *string `json:"password"`
	Code         *string `json:"code"`
	Name         *string `json:"name"`
	Avatar       *string `json:"avatar"`
	Bio          *string `json:"bio"`
	OldPassword  *string `json:"old_password"`
	NewPassword  *string `json:"new_password"`
}

func (h *AuthHandler) RegisterRoutes(r *gin.Engine) {
	r.POST("/api/auth", h.handle)
}

func (h *AuthHandler) handle(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid request body"})
		return
	}

	// Actions that require an authenticated user
	authedActions := map[string]bool{
		"mine": true, "update-profile": true, "change-password": true,
		"logout": true, "delete": true,
	}
	if authedActions[req.Action] {
		if err := h.authenticateRequest(c); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": err.Error()})
			return
		}
	}

	switch req.Action {
	case "register":
		h.register(c, &req)
	case "verify":
		h.verify(c, &req)
	case "login":
		h.login(c, &req)
	case "mine":
		h.mine(c)
	case "update-profile":
		h.updateProfile(c, &req)
	case "change-password":
		h.changePassword(c, &req)
	case "logout":
		h.logout(c)
	case "delete":
		h.deleteAccount(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"detail": "未知操作: " + req.Action})
	}
}

func (h *AuthHandler) authenticateRequest(c *gin.Context) error {
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
		return fmt.Errorf("Missing token")
	}

	claims, err := DecodeAccessToken(tokenStr)
	if err != nil {
		return fmt.Errorf("Invalid token")
	}

	pkFloat, ok := claims["pk"].(float64)
	if !ok {
		return fmt.Errorf("Invalid token")
	}
	pk := int64(pkFloat)

	u, err := GetClient().User.Get(c.Request.Context(), pk)
	if err != nil || u.Status != "active" {
		return fmt.Errorf("User not found")
	}

	SetUser(c, u)
	return nil
}

func (h *AuthHandler) register(c *gin.Context, req *authRequest) {
	if req.Email == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "缺少参数: email"})
		return
	}
	email := *req.Email

	existing, _ := h.repo.GetActiveUserByEmail(c.Request.Context(), email)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": "该邮箱已注册"})
		return
	}

	code := GenerateVerificationCode()
	if err := database.StoreCode(c.Request.Context(), email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "存储验证码失败"})
		return
	}

	if err := sendVerificationCode(email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "邮件发送失败，请检查 SMTP 配置"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "验证码已发送"})
}

func (h *AuthHandler) verify(c *gin.Context, req *authRequest) {
	if req.Email == nil || req.Code == nil || req.Password == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "缺少参数"})
		return
	}
	email, code, password := *req.Email, *req.Code, *req.Password

	if len(password) < 6 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "密码至少需要 6 个字符"})
		return
	}

	valid, _ := database.VerifyCode(c.Request.Context(), email, code)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "验证码无效或已过期"})
		return
	}

	u, err := h.repo.CreateUser(c.Request.Context(), email, password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建用户失败"})
		return
	}

	token, err := CreateAccessToken(u.UserID, u.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建令牌失败"})
		return
	}

	database.StoreJWT(c.Request.Context(), u.UserID, token)
	c.SetCookie("access_token", token, 86400, "/", "", false, true)
	tips := CheckPasswordStrength(password)
	response := gin.H{
		"access_token": token,
		"user":         conv.UserToAPIDict(u),
	}
	if len(tips) > 0 {
		response["password_tips"] = tips
	}
	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) login(c *gin.Context, req *authRequest) {
	if req.Email == nil || req.Password == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "缺少参数"})
		return
	}
	email, password := *req.Email, *req.Password

	u, err := h.repo.GetActiveUserByEmail(c.Request.Context(), email)
	if err != nil || !VerifyPassword(password, u.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "邮箱或密码错误"})
		return
	}

	token, err := CreateAccessToken(u.UserID, u.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建令牌失败"})
		return
	}

	database.StoreJWT(c.Request.Context(), u.UserID, token)
	c.SetCookie("access_token", token, 86400, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"user":         conv.UserToAPIDict(u),
	})
}

func (h *AuthHandler) logout(c *gin.Context) {
	header := c.GetHeader("Authorization")
	if strings.HasPrefix(header, "Bearer ") {
		if claims, err := DecodeAccessToken(header[7:]); err == nil {
			if sub, ok := claims["sub"].(string); ok {
				database.DeleteJWT(c.Request.Context(), sub)
			}
		}
	}
	c.SetCookie("access_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "已退出"})
}

func (h *AuthHandler) mine(c *gin.Context) {
	u := GetUser(c)
	if u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	c.JSON(http.StatusOK, conv.UserToAPIDict(u))
}

func (h *AuthHandler) updateProfile(c *gin.Context, req *authRequest) {
	u := GetUser(c)
	if u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	updated, err := h.repo.UpdateProfile(c.Request.Context(), u, req.Name, req.Avatar, req.Bio)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, conv.UserToAPIDict(updated))
}

func (h *AuthHandler) changePassword(c *gin.Context, req *authRequest) {
	u := GetUser(c)
	if u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	if req.OldPassword == nil || req.NewPassword == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "缺少参数"})
		return
	}
	if !VerifyPassword(*req.OldPassword, u.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "原密码错误"})
		return
	}
	if len(*req.NewPassword) < 6 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "新密码至少需要 6 个字符"})
		return
	}
	if err := h.repo.UpdatePassword(c.Request.Context(), u, *req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "密码修改失败"})
		return
	}
	database.DeleteJWT(c.Request.Context(), u.UserID)
	tips := CheckPasswordStrength(*req.NewPassword)
	response := gin.H{"message": "密码已修改"}
	if len(tips) > 0 {
		response["password_tips"] = tips
	}
	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) deleteAccount(c *gin.Context) {
	u := GetUser(c)
	if u == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	if err := h.repo.SoftDelete(c.Request.Context(), u); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "注销失败"})
		return
	}
	database.DeleteJWT(c.Request.Context(), u.UserID)
	c.JSON(http.StatusOK, gin.H{"message": "账号已注销"})
}

// GetClient is a helper to access the database client from other packages.
func GetClient() *ent.Client {
	return database.Client
}
