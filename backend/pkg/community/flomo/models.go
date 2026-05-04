package flomo

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/uptrace/bun"
)

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

func memoRowFromMap(m map[string]any) *FlomoMemoRow {
	return &FlomoMemoRow{
		Content:       fmt.Sprintf("%v", m["content"]),
		Tags:          getJSONStr(m, "tags"),
		Files:         getJSONStr(m, "files"),
		MemoCreatedAt: fmt.Sprintf("%v", m["memo_created_at"]),
	}
}

func getJSONStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		b, _ := json.Marshal(v)
		s := string(b)
		return &s
	}
	return nil
}

func strPtrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
