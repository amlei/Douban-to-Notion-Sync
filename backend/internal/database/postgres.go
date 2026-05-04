package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	"github.com/lifeink-ai/backend/internal/config"
)

type PostgresConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode"`
}

func (p *PostgresConfig) DSN() string {
	port := p.Port
	if port == 0 {
		port = 5432
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		p.User, p.Password, p.Host, port, p.DBName, p.SSLMode)
}

var DB *bun.DB

func Init(ctx context.Context) error {
	cfg := PostgresConfig{
		Host:    "localhost",
		Port:    5432,
		User:    "lifeink",
		DBName:  "lifeink",
		SSLMode: "disable",
	}
	config.Unmarshal("postgres", &cfg)

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(cfg.DSN())))
	DB = bun.NewDB(sqldb, pgdialect.New())

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}

	log.Println("[db] PostgreSQL connected")
	return nil
}

func SeedPlatforms(ctx context.Context) error {
	type platform struct {
		ID   int    `bun:"id"`
		Name string `bun:"name"`
	}
	platforms := []platform{
		{ID: 1, Name: "douban"},
		{ID: 2, Name: "weread"},
		{ID: 3, Name: "flomo"},
	}
	for _, p := range platforms {
		_, err := DB.NewInsert().
			Model(&p).
			On("CONFLICT (id) DO NOTHING").
			Exec(ctx)
		if err != nil {
			return fmt.Errorf("seed platform %s: %w", p.Name, err)
		}
	}
	log.Println("[db] Platforms seeded")
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
	}
}
