package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Book struct {
	ent.Schema
}

func (Book) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.Int("platform_id"),
		field.String("title"),
		field.String("url"),
		field.String("cover").Optional().Nillable(),
		field.String("author").Optional().Nillable(),
		field.String("country").Optional().Nillable(),
		field.String("translator").Optional().Nillable(),
		field.String("publisher").Optional().Nillable(),
		field.String("pub_date").Optional().Nillable(),
		field.String("price").Optional().Nillable(),
		field.Int("rating").Optional().Nillable(),
		field.String("read_date").Optional().Nillable(),
		field.String("status").Optional().Nillable(),
		field.String("tags").Optional().Nillable(),
		field.String("comment").Optional().Nillable(),
		field.String("external").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Book) Edges() []ent.Edge {
	return nil
}

func (Book) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "url", "platform_id").Unique(),
	}
}
