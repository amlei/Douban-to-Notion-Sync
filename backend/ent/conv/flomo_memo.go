package conv

import (
	"encoding/json"

	"github.com/lifeink-ai/backend/ent"
)

func FlomoMemoToAPIDict(f *ent.FlomoMemo) map[string]any {
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
