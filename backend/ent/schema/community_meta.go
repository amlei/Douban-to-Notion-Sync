package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CommunityMeta struct {
	ent.Schema
}

func (CommunityMeta) Table() string {
	return "community_meta"
}

func (CommunityMeta) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.Int("platform_id"),
		field.Int("bound").Default(0),
		field.String("community_user_id").Optional().Nillable(),
		field.String("profile_json").Optional().Nillable(),
		field.String("session_state_json").Optional().Nillable(),
		field.String("session_expires_at").Optional().Nillable(),
		field.Time("created_at"),
		field.Time("updated_at"),
	}
}

func (CommunityMeta) Edges() []ent.Edge {
	return nil
}

func (CommunityMeta) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "platform_id").Unique(),
	}
}
