package data

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

// Platform represents the platforms table.
type Platform struct {
	bun.BaseModel `bun:"table:platforms"`
	ID            int    `bun:"id,pk,autoincrement"`
	Name          string `bun:"name,unique"`
}

// User represents the users table.
type User struct {
	bun.BaseModel  `bun:"table:users"`
	ID             int64     `bun:"id,pk,autoincrement"`
	UserID         string    `bun:"user_id,unique"`
	Email          string    `bun:"email,unique"`
	PasswordHash   string    `bun:"password_hash"`
	Name           string    `bun:"name"`
	Avatar         *string   `bun:"avatar"`
	Bio            *string   `bun:"bio"`
	Status         string    `bun:"status"`
	EmailVerified  bool      `bun:"email_verified"`
	CreatedAt      time.Time `bun:"created_at"`
	UpdatedAt      time.Time `bun:"updated_at"`
}

func (u *User) ToAPIDict() map[string]any {
	return map[string]any{
		"user_id":         u.UserID,
		"email":           u.Email,
		"name":            u.Name,
		"avatar":          u.Avatar,
		"bio":             u.Bio,
		"email_verified":  u.EmailVerified,
		"created_at":      u.CreatedAt.Format("2006-01-02T15:04:05.999999+08:00"),
	}
}

// CommunityMeta represents the community_meta table.
type CommunityMeta struct {
	bun.BaseModel     `bun:"table:community_meta"`
	ID                int64     `bun:"id,pk,autoincrement"`
	UserID            int64     `bun:"user_id"`
	PlatformID        int       `bun:"platform_id"`
	Bound             int       `bun:"bound"`
	CommunityUserID   *string   `bun:"community_user_id"`
	ProfileJSON       *string   `bun:"profile_json"`
	SessionStateJSON  *string   `bun:"session_state_json"`
	SessionExpiresAt  *string   `bun:"session_expires_at"`
	CreatedAt         time.Time `bun:"created_at"`
	UpdatedAt         time.Time `bun:"updated_at"`
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

// BookRow represents the books table.
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

// MovieRow represents the movies table.
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

// GameRow represents the games table.
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

// ReviewRow represents the reviews table.
type ReviewRow struct {
	bun.BaseModel  `bun:"table:reviews"`
	ID             int64     `bun:"id,pk,autoincrement"`
	UserID         int64     `bun:"user_id"`
	SubjectTitle   string    `bun:"subject_title"`
	SubjectURL     *string   `bun:"subject_url"`
	SubjectImgURL  *string   `bun:"subject_img_url"`
	ReviewTitle    *string   `bun:"review_title"`
	ReviewURL      *string   `bun:"review_url"`
	Date           *string   `bun:"date"`
	ScrapedAt      time.Time `bun:"scraped_at"`
}

// NoteRow represents the notes table.
type NoteRow struct {
	bun.BaseModel `bun:"table:notes"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	Title         string    `bun:"title"`
	URL           *string   `bun:"url"`
	Date          *string   `bun:"date"`
	Location      *string   `bun:"location"`
	Body          *string   `bun:"body"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (n *NoteRow) ToAPIDict() map[string]any {
	return map[string]any{
		"title":    n.Title,
		"url":      n.URL,
		"date":     n.Date,
		"location": n.Location,
		"body":     n.Body,
	}
}

// BookmarkRow represents the bookmarks table.
type BookmarkRow struct {
	bun.BaseModel `bun:"table:bookmarks"`
	ID            int64     `bun:"id,pk,autoincrement"`
	UserID        int64     `bun:"user_id"`
	PlatformID    int       `bun:"platform_id"`
	BookID        string    `bun:"book_id"`
	BookTitle     *string   `bun:"book_title"`
	MarkText      string    `bun:"mark_text"`
	ChapterName   *string   `bun:"chapter_name"`
	ChapterIdx    *int      `bun:"chapter_idx"`
	Style         *int      `bun:"style"`
	CreateTime    *int64    `bun:"create_time"`
	BookmarkID    *string   `bun:"bookmark_id"`
	ScrapedAt     time.Time `bun:"scraped_at"`
}

func (b *BookmarkRow) ToAPIDict() map[string]any {
	return map[string]any{
		"platform_id":  b.PlatformID,
		"book_id":      b.BookID,
		"book_title":   b.BookTitle,
		"mark_text":    b.MarkText,
		"chapter_name": b.ChapterName,
		"chapter_idx":  b.ChapterIdx,
		"style":        b.Style,
		"create_time":  b.CreateTime,
		"bookmark_id":  b.BookmarkID,
	}
}

// FlomoMemoRow represents the flomo_memos table.
type FlomoMemoRow struct {
	bun.BaseModel   `bun:"table:flomo_memos"`
	ID              int64     `bun:"id,pk,autoincrement"`
	UserID          int64     `bun:"user_id"`
	PlatformID      int       `bun:"platform_id"`
	Content         string    `bun:"content"`
	Tags            *string   `bun:"tags"`
	Files           *string   `bun:"files"`
	MemoCreatedAt   string    `bun:"memo_created_at"`
	UpdatedAt       time.Time `bun:"updated_at"`
	ScrapedAt       time.Time `bun:"scraped_at"`
}

func (f *FlomoMemoRow) ToAPIDict() map[string]any {
	var tags any = []any{}
	if f.Tags != nil {
		json.Unmarshal([]byte(*f.Tags), &tags)
	}
	var files any = []any{}
	if f.Files != nil {
		json.Unmarshal([]byte(*f.Files), &files)
	}
	return map[string]any{
		"platform_id":     f.PlatformID,
		"content":         f.Content,
		"tags":            tags,
		"files":           files,
		"memo_created_at": f.MemoCreatedAt,
		"updated_at":      f.UpdatedAt.Format("2006-01-02T15:04:05.999999+08:00"),
	}
}

// SupportedPlatforms returns the list of supported platform names.
func SupportedPlatforms() []string {
	return []string{"douban", "weread", "flomo"}
}

// PlatformNameToID maps a platform name to its ID.
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
