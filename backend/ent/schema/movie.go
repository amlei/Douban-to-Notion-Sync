package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Movie struct {
	ent.Schema
}

func (Movie) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.String("title"),
		field.String("url"),
		field.String("cover").Optional().Nillable(),
		field.String("release_date").Optional().Nillable(),
		field.Int("rating").Optional().Nillable(),
		field.String("watch_date").Optional().Nillable(),
		field.String("tags").Optional().Nillable(),
		field.String("comment").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Movie) Edges() []ent.Edge {
	return nil
}

func (Movie) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "url").Unique(),
	}
}
