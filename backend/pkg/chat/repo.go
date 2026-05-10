package chat

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/message"
	"github.com/lifeink-ai/backend/ent/session"
)

type ChatRepo struct {
	client *ent.Client
}

func NewChatRepo(client *ent.Client) *ChatRepo {
	return &ChatRepo{client: client}
}

func (r *ChatRepo) CreateSession(ctx context.Context, userID int64, title string) (*ent.Session, error) {
	now := time.Now()
	return r.client.Session.Create().
		SetUserID(userID).
		SetTitle(title).
		SetCreatedAt(now).
		SetUpdatedAt(now).
		Save(ctx)
}

func (r *ChatRepo) ListSessions(ctx context.Context, userID int64) ([]*ent.Session, error) {
	return r.client.Session.Query().
		Where(session.UserIDEQ(userID)).
		Order(session.ByUpdatedAt(sql.OrderDesc())).
		All(ctx)
}

func (r *ChatRepo) GetSessionBySessionID(ctx context.Context, sid string) (*ent.Session, error) {
	return r.client.Session.Query().
		Where(session.SessionIDEQ(sid)).
		Only(ctx)
}

func (r *ChatRepo) DeleteSession(ctx context.Context, id int64) error {
	return r.client.Session.DeleteOneID(id).Exec(ctx)
}

func (r *ChatRepo) SaveMessage(ctx context.Context, sessionID int64, role string, content string, reasoning *string) (*ent.Message, error) {
	return r.client.Message.Create().
		SetSessionID(sessionID).
		SetRole(role).
		SetContent(content).
		SetNillableReasoning(reasoning).
		SetCreatedAt(time.Now()).
		Save(ctx)
}

func (r *ChatRepo) ListMessages(ctx context.Context, sessionID int64) ([]*ent.Message, error) {
	return r.client.Message.Query().
		Where(message.SessionIDEQ(sessionID)).
		Order(message.ByCreatedAt(sql.OrderAsc())).
		All(ctx)
}

func (r *ChatRepo) UpdateTitle(ctx context.Context, id int64, title string) error {
	return r.client.Session.UpdateOneID(id).
		SetTitle(title).
		SetUpdatedAt(time.Now()).
		Exec(ctx)
}

func (r *ChatRepo) BatchDeleteSessions(ctx context.Context, userID int64, sessionIDs []string) (int, error) {
	return r.client.Session.Delete().
		Where(session.UserIDEQ(userID), session.SessionIDIn(sessionIDs...)).
		Exec(ctx)
}

func (r *ChatRepo) VerifyOwnership(ctx context.Context, sid string, userID int64) (*ent.Session, error) {
	return r.client.Session.Query().
		Where(session.SessionIDEQ(sid), session.UserIDEQ(userID)).
		Only(ctx)
}
