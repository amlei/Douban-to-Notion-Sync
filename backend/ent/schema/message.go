package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type Message struct {
	ent.Schema
}

func (Message) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("session_id"),
		field.String("role"),
		field.String("content"),
		field.String("reasoning").Optional().Nillable(),
		field.Time("created_at"),
	}
}

func (Message) Edges() []ent.Edge {
	return nil
}

func (Message) Indexes() []ent.Index {
	return nil
}
