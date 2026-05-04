package database

import (
	"context"
	"fmt"
	"time"

	goRedis "github.com/redis/go-redis/v9"

	"github.com/lifeink-ai/backend/internal/config"
)

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	DB       int    `yaml:"db"`
	Password string `yaml:"password"`
}

var client *goRedis.Client

func InitRedis() error {
	cfg := RedisConfig{
		Host: "localhost",
		Port: 6379,
	}
	config.Unmarshal("redis", &cfg)

	client = goRedis.NewClient(&goRedis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		DB:       cfg.DB,
		Password: cfg.Password,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return client.Ping(ctx).Err()
}

func GetClient() *goRedis.Client {
	return client
}

func CloseRedis() error {
	if client != nil {
		return client.Close()
	}
	return nil
}

func StoreCode(ctx context.Context, email, code string) error {
	return client.Set(ctx, "vc:"+email, code, 10*time.Minute).Err()
}

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

func StoreJWT(ctx context.Context, userID, token string) error {
	return client.Set(ctx, "jwt:"+userID, token, 24*time.Hour).Err()
}

func GetJWT(ctx context.Context, userID string) (string, error) {
	return client.Get(ctx, "jwt:"+userID).Result()
}

func DeleteJWT(ctx context.Context, userID string) error {
	return client.Del(ctx, "jwt:"+userID).Err()
}
