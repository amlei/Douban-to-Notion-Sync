package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type User struct {
	ent.Schema
}

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.String("user_id").Unique(),
		field.String("email").Unique(),
		field.String("password_hash"),
		field.String("name"),
		field.String("avatar").Optional().Nillable(),
		field.String("bio").Optional().Nillable(),
		field.String("status").Default("active"),
		field.Bool("email_verified").Default(false),
		field.Time("created_at"),
		field.Time("updated_at"),
	}
}

func (User) Edges() []ent.Edge {
	return nil
}

func (User) Indexes() []ent.Index {
	return nil
}
