package conv

import (
	"github.com/lifeink-ai/backend/ent"
)

func MessageToAPIDict(m *ent.Message) map[string]any {
	d := map[string]any{
		"id":         m.ID,
		"session_id": m.SessionID,
		"role":       m.Role,
		"content":    m.Content,
		"created_at": m.CreatedAt.UnixMilli(),
	}
	if m.Reasoning != nil {
		d["reasoning"] = *m.Reasoning
	}
	return d
}
