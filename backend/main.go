package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"

	"github.com/lifeink-ai/backend/internal/config"
	"github.com/lifeink-ai/backend/internal/database"
	"github.com/lifeink-ai/backend/internal/middleware"
	"github.com/lifeink-ai/backend/pkg/auth"
	"github.com/lifeink-ai/backend/pkg/chat"
	"github.com/lifeink-ai/backend/pkg/community"
	"github.com/lifeink-ai/backend/pkg/scraper"
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

	// Create task manager and scraper client
	taskMgr := community.NewTaskManager()
	scraperClient := scraper.NewClient()

	// Create services
	communitySvc := community.NewCommunityService(database.DB, taskMgr, scraperClient)

	// Create handlers
	authHandler := auth.NewAuthHandler(database.DB)
	communityHandler := community.NewCommunityHandler(communitySvc)
	wsHandler := community.NewWebSocketHandler(taskMgr, database.DB)
	chatHandler := chat.NewChatHandler()

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
