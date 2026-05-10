package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Game struct {
	ent.Schema
}

func (Game) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.String("title"),
		field.String("url"),
		field.String("cover").Optional().Nillable(),
		field.String("description").Optional().Nillable(),
		field.Int("rating").Optional().Nillable(),
		field.String("release_date").Optional().Nillable(),
		field.String("play_date").Optional().Nillable(),
		field.String("tags").Optional().Nillable(),
		field.String("comment").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Game) Edges() []ent.Edge {
	return nil
}

func (Game) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "url").Unique(),
	}
}
