package douban

import (
	"encoding/json"
	"time"

	"github.com/uptrace/bun"
)

type MovieRow struct {
	bun.BaseModel `bun:"table:movies"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	Title         string    `bun:"title"`
	URL           string    `bun:"url"`
	Cover         *string   `bun:"cover"`
	ReleaseDate   *string   `bun:"release_date"`
	Rating        *int      `bun:"rating"`
	WatchDate     *string   `bun:"watch_date"`
	Tags          *string   `bun:"tags"`
	Comment       *string   `bun:"comment"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (m *MovieRow) ToAPIDict() map[string]any {
	var tags any
	if m.Tags != nil {
		json.Unmarshal([]byte(*m.Tags), &tags)
	}
	return map[string]any{
		"title":        m.Title,
		"url":          m.URL,
		"cover":        m.Cover,
		"release_date": m.ReleaseDate,
		"rating":       m.Rating,
		"watch_date":   m.WatchDate,
		"tags":         tags,
		"comment":      m.Comment,
	}
}

type GameRow struct {
	bun.BaseModel `bun:"table:games"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	Title         string    `bun:"title"`
	URL           string    `bun:"url"`
	Cover         *string   `bun:"cover"`
	Description   *string   `bun:"description"`
	Rating        *int      `bun:"rating"`
	ReleaseDate   *string   `bun:"release_date"`
	PlayDate      *string   `bun:"play_date"`
	Tags          *string   `bun:"tags"`
	Comment       *string   `bun:"comment"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

type ReviewRow struct {
	bun.BaseModel   `bun:"table:reviews"`
	ID              int64     `bun:"id,pk,autoincrement"`
	UserID          int64     `bun:"user_id"`
	SubjectTitle    string    `bun:"subject_title"`
	SubjectURL      *string   `bun:"subject_url"`
	SubjectImgURL   *string   `bun:"subject_img_url"`
	ReviewTitle     *string   `bun:"review_title"`
	ReviewURL       *string   `bun:"review_url"`
	Date            *string   `bun:"date"`
	ScrapedAt       time.Time `bun:"scraped_at"`
}
