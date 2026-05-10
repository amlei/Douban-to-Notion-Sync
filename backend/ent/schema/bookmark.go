package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type Bookmark struct {
	ent.Schema
}

func (Bookmark) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.Int64("user_id"),
		field.Int("platform_id"),
		field.String("book_id"),
		field.String("book_title").Optional().Nillable(),
		field.String("mark_text"),
		field.String("chapter_name").Optional().Nillable(),
		field.Int("chapter_idx").Optional().Nillable(),
		field.Int("style").Optional().Nillable(),
		field.Int64("create_time").Optional().Nillable(),
		field.String("bookmark_id").Optional().Nillable(),
		field.Time("scraped_at"),
	}
}

func (Bookmark) Edges() []ent.Edge {
	return nil
}

func (Bookmark) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("user_id", "platform_id", "book_id", "bookmark_id").Unique(),
	}
}
