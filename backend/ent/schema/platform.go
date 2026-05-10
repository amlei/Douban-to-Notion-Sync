package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/field"
)

type Platform struct {
	ent.Schema
}

func (Platform) Fields() []ent.Field {
	return []ent.Field{
		field.Int("id").SchemaType(map[string]string{
			"postgres": "serial",
		}).Positive(),
		field.String("name").Unique(),
	}
}

func (Platform) Edges() []ent.Edge {
	return nil
}

func (Platform) Indexes() []ent.Index {
	return nil
}
