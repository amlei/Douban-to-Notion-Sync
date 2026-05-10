package weread

import (
	"encoding/json"
	"fmt"

	"github.com/lifeink-ai/backend/ent"
)

func BookmarkToAPIDict(b *ent.Bookmark) map[string]any {
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

func NoteToAPIDict(n *ent.Note) map[string]any {
	return map[string]any{
		"title":    n.Title,
		"url":      n.URL,
		"date":     n.Date,
		"location": n.Location,
		"body":     n.Body,
	}
}

func getStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		s := fmt.Sprintf("%v", v)
		return &s
	}
	return nil
}

func getInt(m map[string]any, key string) *int {
	if v, ok := m[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int(n)
			return &i
		case int:
			return &n
		}
	}
	return nil
}

func getInt64(m map[string]any, key string) *int64 {
	if v, ok := m[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int64(n)
			return &i
		case int:
			i := int64(n)
			return &i
		case int64:
			return &n
		}
	}
	return nil
}

func getJSONStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		b, _ := json.Marshal(v)
		s := string(b)
		return &s
	}
	return nil
}
