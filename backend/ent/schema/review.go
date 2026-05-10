package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Review struct {
	ent.Schema
}

func (Review) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.String("subject_title"),
		field.String("subject_url").Optional().Nillable(),
		field.String("subject_img_url").Optional().Nillable(),
		field.String("review_title").Optional().Nillable(),
		field.String("review_url").Optional().Nillable(),
		field.String("date").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Review) Edges() []ent.Edge {
	return nil
}

func (Review) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "review_url").Unique(),
	}
}
