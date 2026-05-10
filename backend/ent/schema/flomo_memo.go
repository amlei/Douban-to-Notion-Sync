package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type FlomoMemo struct {
	ent.Schema
}

func (FlomoMemo) Table() string {
	return "flomo_memos"
}

func (FlomoMemo) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.Int("platform_id"),
		field.String("content"),
		field.String("tags").Optional().Nillable(),
		field.String("files").Optional().Nillable(),
		field.String("memo_created_at"),
		field.Time("updated_at"),
		field.Time("scraped_at"),
	}
}

func (FlomoMemo) Edges() []ent.Edge {
	return nil
}

func (FlomoMemo) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "platform_id", "memo_created_at").Unique(),
	}
}
