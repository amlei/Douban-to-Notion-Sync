package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Note struct {
	ent.Schema
}

func (Note) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.Int("platform_id").Optional().Nillable(),
		field.String("title"),
		field.String("url").Optional().Nillable(),
		field.String("date").Optional().Nillable(),
		field.String("location").Optional().Nillable(),
		field.String("body").Optional().Nillable(),
		field.String("book_id").Optional().Nillable(),
		field.String("abstract").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Note) Edges() []ent.Edge {
	return nil
}

func (Note) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "url").Unique(),
		index.Fields("user_id", "platform_id", "book_id"),
	}
}
