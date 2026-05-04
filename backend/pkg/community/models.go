package community

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"time"

	"github.com/uptrace/bun"
)

const (
	PlatformDouban = 1
	PlatformWeread = 2
	PlatformFlomo  = 3
)

type Platform struct {
	bun.BaseModel `bun:"table:platforms"`
	ID            int    `bun:"id,pk,autoincrement"`
	Name          string `bun:"name,unique"`
}

type CommunityMeta struct {
	bun.BaseModel    `bun:"table:community_meta"`
	ID               int64     `bun:"id,pk,autoincrement"`
	UserID           int64     `bun:"user_id"`
	PlatformID       int       `bun:"platform_id"`
	Bound            int       `bun:"bound"`
	CommunityUserID  *string   `bun:"community_user_id"`
	ProfileJSON      *string   `bun:"profile_json"`
	SessionStateJSON *string   `bun:"session_state_json"`
	SessionExpiresAt *string   `bun:"session_expires_at"`
	CreatedAt        time.Time `bun:"created_at"`
	UpdatedAt        time.Time `bun:"updated_at"`
}

func (m *CommunityMeta) ToAPIDict() map[string]any {
	var profile any
	if m.ProfileJSON != nil {
		json.Unmarshal([]byte(*m.ProfileJSON), &profile)
	}
	return map[string]any{
		"bound":       m.Bound == 1,
		"platform_id": m.PlatformID,
		"user_id":     m.CommunityUserID,
		"profile":     profile,
	}
}

type BookRow struct {
	bun.BaseModel `bun:"table:books"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	PlatformID    int       `bun:"platform_id"`
	Title         string    `bun:"title"`
	URL           string    `bun:"url"`
	Cover         *string   `bun:"cover"`
	Author        *string   `bun:"author"`
	Country       *string   `bun:"country"`
	Translator    *string   `bun:"translator"`
	Publisher     *string   `bun:"publisher"`
	PubDate       *string   `bun:"pub_date"`
	Price         *string   `bun:"price"`
	Rating        *int      `bun:"rating"`
	ReadDate      *string   `bun:"read_date"`
	Status        *string   `bun:"status"`
	Tags          *string   `bun:"tags"`
	Comment       *string   `bun:"comment"`
	External      *string   `bun:"external"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (b *BookRow) ChangeHash() string {
	status := ""
	if b.Status != nil {
		status = *b.Status
	}
	rating := ""
	if b.Rating != nil {
		rating = fmt.Sprintf("%d", *b.Rating)
	}
	ext := ""
	if b.External != nil {
		ext = *b.External
	}
	payload := fmt.Sprintf("%s|%s|%s", status, rating, ext)
	return fmt.Sprintf("%x", md5.Sum([]byte(payload)))
}

func (b *BookRow) ToAPIDict() map[string]any {
	d := map[string]any{
		"platform_id": b.PlatformID,
		"title":       b.Title,
		"url":         b.URL,
		"cover":       b.Cover,
		"author":      b.Author,
		"translator":  b.Translator,
		"publisher":   b.Publisher,
		"price":       b.Price,
		"rating":      b.Rating,
		"status":      b.Status,
	}
	var ext map[string]any
	if b.External != nil {
		json.Unmarshal([]byte(*b.External), &ext)
	}
	if b.PlatformID == PlatformWeread {
		d["book_id"] = b.URL
		if ext != nil {
			for k, v := range ext {
				d[k] = v
			}
		}
	} else {
		var tags any
		if b.Tags != nil {
			json.Unmarshal([]byte(*b.Tags), &tags)
		}
		d["country"] = b.Country
		d["pub_date"] = b.PubDate
		d["read_date"] = b.ReadDate
		d["tags"] = tags
		d["comment"] = b.Comment
	}
	return d
}

func SupportedPlatforms() []string {
	return []string{"douban", "weread", "flomo"}
}

func PlatformNameToID(name string) int {
	switch name {
	case "douban":
		return PlatformDouban
	case "weread":
		return PlatformWeread
	case "flomo":
		return PlatformFlomo
	default:
		return 0
	}
}
