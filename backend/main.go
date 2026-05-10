package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/community/openai"
	"github.com/lifeink-ai/backend/internal/config"
	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/internal/middleware"
	"github.com/lifeink-ai/backend/internal/task"
	"github.com/lifeink-ai/backend/internal/ws"
	"github.com/lifeink-ai/backend/pkg/auth"
	"github.com/lifeink-ai/backend/pkg/community/platform"
	"github.com/lifeink-ai/backend/pkg/chat"
)

func main() {
	ctx := context.Background()

	// Load config
	config.Load()
	log.Println("[main] Config loaded")

	// Init PostgreSQL
	if err := database.Init(ctx); err != nil {
		log.Fatalf("[main] DB init failed: %v", err)
	}
	defer database.Close()

	// Seed platforms
	if err := database.SeedPlatforms(ctx); err != nil {
		log.Fatalf("[main] Seed platforms failed: %v", err)
	}

	// Init Redis
	if err := database.InitRedis(); err != nil {
		log.Fatalf("[main] Redis init failed: %v", err)
	}
	defer database.CloseRedis()
	log.Println("[main] Redis connected")

	// Create task manager
	taskMgr := task.NewManager[platform.BindData]()

	// Create services
	communitySvc := platform.NewCommunityService(database.Client, database.SQLDB, taskMgr)

	// Create handlers
	authHandler := auth.NewAuthHandler(database.Client)
	communityHandler := platform.NewCommunityHandler(communitySvc)
	wsAuth := ws.NewAuthenticator(database.Client)
	wsHandler := platform.NewWebSocketHandler(wsAuth, taskMgr)

	// Load LLM config and create client
	var llmCfg openai.LLMConfig
	config.Unmarshal("llm", &llmCfg)
	llmClient := openai.NewClient(llmCfg)
	chatRepo := chat.NewChatRepo(database.Client)
	chatHandler := chat.NewChatHandler(llmClient, chatRepo)

	// Setup Gin
	r := gin.Default()

	// Middleware
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.AuthMiddleware())

	// Register routes
	authHandler.RegisterRoutes(r)
	communityHandler.RegisterRoutes(r)
	wsHandler.RegisterRoutes(r)
	chatHandler.RegisterRoutes(r)

	// Start server
	addr := ":8000"
	log.Printf("[main] Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("[main] Server failed: %v", err)
	}
}
