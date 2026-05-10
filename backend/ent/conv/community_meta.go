package conv

import (
	"encoding/json"

	"github.com/lifeink-ai/backend/ent"
)

func CommunityMetaToAPIDict(m *ent.CommunityMeta) map[string]any {
	var profile any
	if m.ProfileJSON != nil {
		json.Unmarshal([]byte(*m.ProfileJSON), &profile)
	}
	return map[string]any{
		"bound":       m.Bound == 1,
		"platform_id": m.PlatformID,
		"user_id":     m.CommunityUserID,
		"profile":     profile,
	}
}
