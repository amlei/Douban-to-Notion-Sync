package config

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"sync"

	"gopkg.in/yaml.v3"
)

type SmtpConfig struct {
	Provider  string `yaml:"provider"`
	Host      string `yaml:"host"`
	Port      int    `yaml:"port"`
	UseTLS    bool   `yaml:"use_tls"`
	UseSSL    bool   `yaml:"use_ssl"`
	Username  string `yaml:"username"`
	Password  string `yaml:"password"`
	FromEmail string `yaml:"from_email"`
	FromName  string `yaml:"from_name"`
}

type SmtpResolved struct {
	Host      string
	Port      int
	UseTLS    bool
	UseSSL    bool
	Username  string
	Password  string
	FromEmail string
	FromName  string
}

var smtpPresets = map[string]SmtpResolved{
	"qq":      {Host: "smtp.qq.com", Port: 465, UseTLS: false, UseSSL: true},
	"outlook": {Host: "smtp-mail.outlook.com", Port: 587, UseTLS: true, UseSSL: false},
	"163":     {Host: "smtp.163.com", Port: 465, UseTLS: false, UseSSL: true},
	"126":     {Host: "smtp.126.com", Port: 465, UseTLS: false, UseSSL: true},
	"yeah":    {Host: "smtp.yeah.net", Port: 465, UseTLS: false, UseSSL: true},
}

func (s *SmtpConfig) Resolved() SmtpResolved {
	preset := smtpPresets[s.Provider]
	r := SmtpResolved{
		Host:      s.Host,
		Port:      s.Port,
		UseTLS:    s.UseTLS,
		UseSSL:    s.UseSSL,
		Username:  s.Username,
		Password:  s.Password,
		FromEmail: s.FromEmail,
		FromName:  s.FromName,
	}
	if r.Host == "" {
		r.Host = preset.Host
	}
	if r.Port == 0 {
		r.Port = preset.Port
	}
	if !r.UseTLS {
		r.UseTLS = preset.UseTLS
	}
	if !r.UseSSL {
		r.UseSSL = preset.UseSSL
	}
	if r.FromEmail == "" {
		r.FromEmail = r.Username
	}
	return r
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	DB       int    `yaml:"db"`
	Password string `yaml:"password"`
}

type PostgresConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode"`
}

func (p *PostgresConfig) DSN() string {
	return "postgres://" + p.User + ":" + p.Password + "@" + p.Host + ":" + itoa(p.Port) + "/" + p.DBName + "?sslmode=" + p.SSLMode
}

type Config struct {
	Smtp      SmtpConfig      `yaml:"smtp"`
	Redis     RedisConfig     `yaml:"redis"`
	Postgres  PostgresConfig  `yaml:"postgres"`
	JWTSecret string          `yaml:"jwt_secret"`
	ScraperURL string         `yaml:"scraper_url"`
}

var (
	cfg     *Config
	cfgOnce sync.Once
)

func Load() *Config {
	cfgOnce.Do(func() {
		cfg = &Config{
			Smtp: SmtpConfig{
				Provider: "qq",
			},
			Redis: RedisConfig{
				Host: "localhost",
				Port: 6379,
			},
			Postgres: PostgresConfig{
				Host:    "localhost",
				Port:    5432,
				User:    "lifeink",
				DBName:  "lifeink",
				SSLMode: "disable",
			},
			ScraperURL: "http://127.0.0.1:50051",
		}
		data, err := os.ReadFile("config.yaml")
		if err == nil {
			yaml.Unmarshal(data, cfg)
		}
		if cfg.JWTSecret == "" {
			b := make([]byte, 32)
			rand.Read(b)
			cfg.JWTSecret = hex.EncodeToString(b)
			saveConfig()
		}
	})
	return cfg
}

func Get() *Config {
	if cfg == nil {
		return Load()
	}
	return cfg
}

func saveConfig() {
	if cfg == nil {
		return
	}
	data, _ := yaml.Marshal(cfg)
	os.WriteFile("config.yaml", data, 0644)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
