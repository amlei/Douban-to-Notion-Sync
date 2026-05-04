package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/lifeink-ai/backend/internal/config"
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

func loadSmtpConfig() SmtpResolved {
	cfg := SmtpConfig{Provider: "qq"}
	config.Unmarshal("smtp", &cfg)

	preset := smtpPresets[cfg.Provider]
	r := SmtpResolved{
		Host:      cfg.Host,
		Port:      cfg.Port,
		UseTLS:    cfg.UseTLS,
		UseSSL:    cfg.UseSSL,
		Username:  cfg.Username,
		Password:  cfg.Password,
		FromEmail: cfg.FromEmail,
		FromName:  cfg.FromName,
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

func Send(to, subject, htmlBody string) error {
	cfg := loadSmtpConfig()

	from := cfg.FromEmail
	fromHeader := from
	if cfg.FromName != "" {
		fromHeader = fmt.Sprintf("%s <%s>", cfg.FromName, from)
	}

	headers := map[string]string{
		"From":         fromHeader,
		"To":           to,
		"Subject":      subject,
		"MIME-Version": "1.0",
		"Content-Type": "text/html; charset=UTF-8",
	}

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(k + ": " + v + "\r\n")
	}
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)

	if cfg.UseSSL {
		tlsConfig := &tls.Config{ServerName: cfg.Host}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("tls dial: %w", err)
		}
		defer conn.Close()
		c, err := smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return fmt.Errorf("smtp client: %w", err)
		}
		defer c.Close()
		return sendMail(c, auth, from, to, msg.String())
	}

	c, err := smtp.Dial(addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer c.Close()
	if cfg.UseTLS {
		if err := c.StartTLS(&tls.Config{ServerName: cfg.Host}); err != nil {
			return fmt.Errorf("starttls: %w", err)
		}
	}
	return sendMail(c, auth, from, to, msg.String())
}

func sendMail(c *smtp.Client, auth smtp.Auth, from, to, msg string) error {
	if auth != nil {
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return err
	}
	if err := c.Rcpt(to); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return err
	}
	return w.Close()
}
