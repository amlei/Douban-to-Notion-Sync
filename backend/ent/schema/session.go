package schema

import (
	"strings"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Session struct {
	ent.Schema
}

func (Session) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id").SchemaType(map[string]string{
			"postgres": "bigserial",
		}).Positive(),
		field.String("session_id").Unique().DefaultFunc(func() string {
			return strings.ReplaceAll(uuid.New().String(), "-", "")
		}),
		field.Int64("user_id"),
		field.String("title"),
		field.Time("created_at"),
		field.Time("updated_at"),
	}
}

func (Session) Edges() []ent.Edge {
	return nil
}

func (Session) Indexes() []ent.Index {
	return nil
}
