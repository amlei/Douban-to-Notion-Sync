package douban

import (
	"encoding/json"
	"fmt"

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

func getJSONStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		b, _ := json.Marshal(v)
		s := string(b)
		return &s
	}
	return nil
}
