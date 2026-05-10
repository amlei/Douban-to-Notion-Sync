package ws

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/uptrace/bun"

	"github.com/lifeink-ai/backend/pkg/auth"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Authenticator handles WebSocket authentication and connection upgrade.
type Authenticator struct {
	db *bun.DB
}

// NewAuthenticator creates an Authenticator backed by the given DB.
func NewAuthenticator(db *bun.DB) *Authenticator {
	return &Authenticator{db: db}
}

// Handshake extracts the JWT token, validates it, looks up the user, and
// upgrades the HTTP connection to WebSocket. Returns the authenticated user
// and the upgraded connection.
func (a *Authenticator) Handshake(c *gin.Context) (*auth.User, *websocket.Conn, error) {
	token := ""
	if cookie, err := c.Cookie("access_token"); err == nil && cookie != "" {
		token = cookie
	}
	if token == "" {
		subprotocols := websocket.Subprotocols(c.Request)
		if len(subprotocols) > 0 {
			token = subprotocols[0]
		}
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Missing token"})
		return nil, nil, errMissingToken
	}

	claims, err := auth.DecodeAccessToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
		return nil, nil, errInvalidToken
	}

	pkFloat, ok := claims["pk"].(float64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid token"})
		return nil, nil, errInvalidToken
	}
	pk := int64(pkFloat)

	responseHeader := http.Header{}
	// Only echo subprotocol when client explicitly sent one (subprotocol-based auth).
	// Per RFC 6455, server MUST NOT send Sec-WebSocket-Protocol if client didn't request any.
	if len(websocket.Subprotocols(c.Request)) > 0 {
		responseHeader.Set("Sec-WebSocket-Protocol", token)
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, responseHeader)
	if err != nil {
		return nil, nil, err
	}

	ctx := c.Request.Context()
	user := &auth.User{}
	err = a.db.NewSelect().Model(user).Where("id = ? AND status = 'active'", pk).Scan(ctx)
	if err != nil {
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4001, "auth failure"))
		return nil, nil, err
	}

	return user, conn, nil
}

// WriteJSON sends v as a text WebSocket message.
func WriteJSON(conn *websocket.Conn, v any) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, data)
}

type handshakeError struct {
	msg string
}

func (e *handshakeError) Error() string { return e.msg }

var (
	errMissingToken = &handshakeError{msg: "missing token"}
	errInvalidToken = &handshakeError{msg: "invalid token"}
)
