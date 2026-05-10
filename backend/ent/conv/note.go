package conv

import (
	"github.com/lifeink-ai/backend/ent"
)

func NoteToAPIDict(n *ent.Note) map[string]any {
	return map[string]any{
		"title":    n.Title,
		"url":      n.URL,
		"date":     n.Date,
		"location": n.Location,
		"body":     n.Body,
	}
}
