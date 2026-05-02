package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/lifeink-ai/backend/internal/config"
)

const jwtExpireMinutes = 1440

func HashPassword(plain string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func VerifyPassword(plain, hashed string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}

func CheckPasswordStrength(password string) []string {
	var tips []string
	hasUpper := false
	hasLower := false
	hasDigit := false
	hasSpecial := false
	for _, c := range password {
		switch {
		case c >= 'A' && c <= 'Z':
			hasUpper = true
		case c >= 'a' && c <= 'z':
			hasLower = true
		case c >= '0' && c <= '9':
			hasDigit = true
		default:
			if c >= 33 && c <= 126 {
				hasSpecial = true
			}
		}
	}
	if len(password) < 6 {
		tips = append(tips, "密码至少需要 6 个字符")
	}
	if !hasUpper {
		tips = append(tips, "建议包含大写字母")
	}
	if !hasLower {
		tips = append(tips, "建议包含小写字母")
	}
	if !hasDigit {
		tips = append(tips, "建议包含数字")
	}
	if !hasSpecial {
		tips = append(tips, "建议包含特殊字符")
	}
	return tips
}

func CreateAccessToken(userID string, userPK int64) (string, error) {
	secret := config.Get().JWTSecret
	expire := time.Now().Add(jwtExpireMinutes * time.Minute)
	claims := jwt.MapClaims{
		"sub": userID,
		"pk":  userPK,
		"exp": expire.Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func DecodeAccessToken(tokenStr string) (jwt.MapClaims, error) {
	secret := config.Get().JWTSecret
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func GenerateUserID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func GenerateVerificationCode() string {
	b := make([]byte, 3)
	rand.Read(b)
	n := int(b[0])<<16 | int(b[1])<<8 | int(b[2])
	return fmt.Sprintf("%06d", n%1000000)
}
