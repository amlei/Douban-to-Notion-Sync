package conv

import (
	"github.com/lifeink-ai/backend/ent"
)

func NoteToAPIDict(n *ent.Note) map[string]any {
	d := map[string]any{
		"title":    n.Title,
		"url":      n.URL,
		"date":     n.Date,
		"location": n.Location,
		"body":     n.Body,
	}
	if n.PlatformID != nil {
		d["platform_id"] = *n.PlatformID
	}
	if n.BookID != nil {
		d["book_id"] = *n.BookID
	}
	if n.Abstract != nil {
		d["abstract"] = *n.Abstract
	}
	return d
}
