package conv

import (
	"encoding/json"

	"github.com/lifeink-ai/backend/ent"
)

func MovieToAPIDict(m *ent.Movie) map[string]any {
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
