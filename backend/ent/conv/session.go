package conv

import (
	"github.com/lifeink-ai/backend/ent"
)

func SessionToAPIDict(s *ent.Session) map[string]any {
	return map[string]any{
		"session_id": s.SessionID,
		"title":      s.Title,
		"created_at": s.CreatedAt.UnixMilli(),
	}
}
