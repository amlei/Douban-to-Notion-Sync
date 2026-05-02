package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"

	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/pkg/data"
	pkgRedis "github.com/lifeink-ai/backend/pkg/redis"
)

type AuthHandler struct {
	repo *AuthRepo
}

func NewAuthHandler(db *bun.DB) *AuthHandler {
	return &AuthHandler{repo: NewAuthRepo(db)}
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
	case "delete":
		h.deleteAccount(c)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"detail": "未知操作: " + req.Action})
	}
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
	if err := pkgRedis.StoreCode(c.Request.Context(), email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "存储验证码失败"})
		return
	}

	if err := sendEmailAsync(email, code); err != nil {
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

	valid, _ := pkgRedis.VerifyCode(c.Request.Context(), email, code)
	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "验证码无效或已过期"})
		return
	}

	user, err := h.repo.CreateUser(c.Request.Context(), email, password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建用户失败"})
		return
	}

	token, err := CreateAccessToken(user.UserID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建令牌失败"})
		return
	}

	pkgRedis.StoreJWT(c.Request.Context(), user.UserID, token)
	tips := CheckPasswordStrength(password)
	response := gin.H{
		"access_token": token,
		"user":         user.ToAPIDict(),
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

	user, err := h.repo.GetActiveUserByEmail(c.Request.Context(), email)
	if err != nil || !VerifyPassword(password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "邮箱或密码错误"})
		return
	}

	token, err := CreateAccessToken(user.UserID, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "创建令牌失败"})
		return
	}

	pkgRedis.StoreJWT(c.Request.Context(), user.UserID, token)
	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"user":         user.ToAPIDict(),
	})
}

func (h *AuthHandler) mine(c *gin.Context) {
	user := data.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	c.JSON(http.StatusOK, user.ToAPIDict())
}

func (h *AuthHandler) updateProfile(c *gin.Context, req *authRequest) {
	user := data.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	updated, err := h.repo.UpdateProfile(c.Request.Context(), user, req.Name, req.Avatar, req.Bio)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, updated.ToAPIDict())
}

func (h *AuthHandler) changePassword(c *gin.Context, req *authRequest) {
	user := data.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	if req.OldPassword == nil || req.NewPassword == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "缺少参数"})
		return
	}
	if !VerifyPassword(*req.OldPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "原密码错误"})
		return
	}
	if len(*req.NewPassword) < 6 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"detail": "新密码至少需要 6 个字符"})
		return
	}
	if err := h.repo.UpdatePassword(c.Request.Context(), user, *req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "密码修改失败"})
		return
	}
	pkgRedis.DeleteJWT(c.Request.Context(), user.UserID)
	tips := CheckPasswordStrength(*req.NewPassword)
	response := gin.H{"message": "密码已修改"}
	if len(tips) > 0 {
		response["password_tips"] = tips
	}
	c.JSON(http.StatusOK, response)
}

func (h *AuthHandler) deleteAccount(c *gin.Context) {
	user := data.GetUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "未登录"})
		return
	}
	if err := h.repo.SoftDelete(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "注销失败"})
		return
	}
	pkgRedis.DeleteJWT(c.Request.Context(), user.UserID)
	c.JSON(http.StatusOK, gin.H{"message": "账号已注销"})
}

func sendEmailAsync(email, code string) error {
	// Run email sending synchronously for simplicity - could be made async with goroutine
	// but Python version used asyncio.to_thread which is effectively synchronous in the request
	return pkgSendEmail(email, code)
}

var pkgSendEmail = defaultSendEmail

func defaultSendEmail(email, code string) error {
	return errors.New("email not configured - import pkg/email for actual implementation")
}

// SetEmailSender allows the main package to inject the actual email sender.
func SetEmailSender(fn func(string, string) error) {
	pkgSendEmail = fn
}

// GetDB is a helper to access the database from other packages.
func GetDB() *bun.DB {
	return database.DB
}
