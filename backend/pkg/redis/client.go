package redis

import (
	"context"
	"fmt"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"github.com/lifeink-ai/backend/internal/config"
)

var client *goRedis.Client

func Init() error {
	cfg := config.Get()
	client = goRedis.NewClient(&goRedis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port),
		DB:       cfg.Redis.DB,
		Password: cfg.Redis.Password,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return client.Ping(ctx).Err()
}

func GetClient() *goRedis.Client {
	return client
}

func Close() error {
	if client != nil {
		return client.Close()
	}
	return nil
}

// StoreCode stores a verification code with 10 minute TTL.
func StoreCode(ctx context.Context, email, code string) error {
	return client.Set(ctx, "vc:"+email, code, 10*time.Minute).Err()
}

// VerifyCode checks and deletes the verification code.
func VerifyCode(ctx context.Context, email, code string) (bool, error) {
	key := "vc:" + email
	stored, err := client.Get(ctx, key).Result()
	if err != nil {
		return false, nil
	}
	if stored == code {
		client.Del(ctx, key)
		return true, nil
	}
	return false, nil
}

// StoreJWT stores a JWT token with 24 hour TTL.
func StoreJWT(ctx context.Context, userID, token string) error {
	return client.Set(ctx, "jwt:"+userID, token, 24*time.Hour).Err()
}

// GetJWT retrieves a stored JWT token.
func GetJWT(ctx context.Context, userID string) (string, error) {
	return client.Get(ctx, "jwt:"+userID).Result()
}

// DeleteJWT removes a JWT token (logout/password change).
func DeleteJWT(ctx context.Context, userID string) error {
	return client.Del(ctx, "jwt:"+userID).Err()
}
