package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	_ "github.com/lib/pq"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/migrate"
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
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		p.Host, port, p.User, p.Password, p.DBName, p.SSLMode)
}

var (
	Client *ent.Client
	SQLDB  *sql.DB
)

func Init(ctx context.Context) error {
	cfg := PostgresConfig{
		Host:    "localhost",
		Port:    5432,
		User:    "lifeink",
		DBName:  "lifeink",
		SSLMode: "disable",
	}
	config.Unmarshal("postgres", &cfg)

	sqldb, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		return fmt.Errorf("open postgres: %w", err)
	}
	if err := sqldb.Ping(); err != nil {
		return fmt.Errorf("ping postgres: %w", err)
	}
	SQLDB = sqldb

	drv := entsql.OpenDB(dialect.Postgres, sqldb)
	Client = ent.NewClient(ent.Driver(drv))

	// Auto-migration: creates missing tables/columns, does not drop existing data.
	if err := Client.Schema.Create(
		ctx,
		migrate.WithForeignKeys(false),
	); err != nil {
		return fmt.Errorf("auto-migrate: %w", err)
	}

	log.Println("[db] PostgreSQL connected (ent auto-migration done)")
	return nil
}

func SeedPlatforms(ctx context.Context) error {
	platforms := []struct {
		ID   int
		Name string
	}{
		{ID: 1, Name: "douban"},
		{ID: 2, Name: "weread"},
		{ID: 3, Name: "flomo"},
	}
	for _, p := range platforms {
		_, err := SQLDB.ExecContext(ctx,
			`INSERT INTO platforms (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
			p.ID, p.Name,
		)
		if err != nil {
			return fmt.Errorf("seed platform %s: %w", p.Name, err)
		}
	}
	log.Println("[db] Platforms seeded")
	return nil
}

func Close() {
	if Client != nil {
		Client.Close()
	}
}
