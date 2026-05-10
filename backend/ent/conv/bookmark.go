package conv

import (
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
