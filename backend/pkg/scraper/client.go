package scraper

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/lifeink-ai/backend/internal/config"
)

// SSEEvent represents a Server-Sent Event from the Python scraper service.
type SSEEvent struct {
	Event string
	Data  string
}

// BindRequest is the request body for POST /bind.
type BindRequest struct {
	Platform string `json:"platform"`
	UserID   int64  `json:"user_id"`
	Channel  string `json:"channel"`
}

// SyncRequest is the request body for POST /sync.
type SyncRequest struct {
	Platform         string         `json:"platform"`
	UserID           int64          `json:"user_id"`
	SessionStateJSON string         `json:"session_state_json"`
	CommunityUserID  string         `json:"community_user_id"`
	ExistingBookURLs []string       `json:"existing_book_urls"`
	ExistingMovieURLs []string      `json:"existing_movie_urls"`
	BookmarkSynckeys map[string]int `json:"bookmark_synckeys"`
}

// RefreshRequest is the request body for POST /refresh.
type RefreshRequest struct {
	Platform         string `json:"platform"`
	SessionStateJSON string `json:"session_state_json"`
}

// RefreshResponse is the response body for POST /refresh.
type RefreshResponse struct {
	CommunityUserID string `json:"community_user_id"`
	ProfileJSON     string `json:"profile_json"`
}

// UnbindRequest is the request body for POST /unbind.
type UnbindRequest struct {
	Platform         string `json:"platform"`
	SessionStateJSON string `json:"session_state_json"`
}

type Client struct {
	httpClient *http.Client
	baseURL    string
}

func NewClient() *Client {
	baseURL := config.GetString("scraper_url")
	if baseURL == "" {
		baseURL = "http://127.0.0.1:50051"
	}
	return &Client{
		httpClient: &http.Client{},
		baseURL:    baseURL,
	}
}

// CallBind starts a bind operation and returns a channel of SSE events.
func (c *Client) CallBind(ctx context.Context, req BindRequest) (<-chan SSEEvent, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/bind", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call bind: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("bind returned status %d", resp.StatusCode)
	}

	ch := make(chan SSEEvent, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		parseSSE(resp.Body, ch)
	}()
	return ch, nil
}

// CallSync starts a sync operation and returns a channel of SSE events.
func (c *Client) CallSync(ctx context.Context, req SyncRequest) (<-chan SSEEvent, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/sync", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call sync: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("sync returned status %d", resp.StatusCode)
	}

	ch := make(chan SSEEvent, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()
		parseSSE(resp.Body, ch)
	}()
	return ch, nil
}

// CallRefresh calls the refresh endpoint.
func (c *Client) CallRefresh(ctx context.Context, req RefreshRequest) (*RefreshResponse, error) {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/refresh", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("call refresh: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("refresh returned status %d", resp.StatusCode)
	}

	var result RefreshResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode refresh response: %w", err)
	}
	return &result, nil
}

// CallUnbind calls the unbind endpoint to logout from the platform.
func (c *Client) CallUnbind(ctx context.Context, req UnbindRequest) error {
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/unbind", bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("call unbind: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unbind returned status %d", resp.StatusCode)
	}
	return nil
}

// HealthCheck calls the health endpoint.
func (c *Client) HealthCheck(ctx context.Context) error {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check failed: %d", resp.StatusCode)
	}
	return nil
}

func parseSSE(reader io.Reader, ch chan<- SSEEvent) {
	scanner := bufio.NewScanner(reader)
	var event string
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 {
			// Empty line = end of event
			continue
		}
		if line[0] == ':' {
			// Comment
			continue
		}
		// Parse "field: value" or "field"
		colon := -1
		for i, c := range line {
			if c == ':' {
				colon = i
				break
			}
		}
		field := line
		value := ""
		if colon >= 0 {
			field = line[:colon]
			if colon+1 < len(line) && line[colon+1] == ' ' {
				value = line[colon+2:]
			} else if colon+1 < len(line) {
				value = line[colon+1:]
			}
		}

		switch field {
		case "event":
			event = value
		case "data":
			ch <- SSEEvent{Event: event, Data: value}
		}
	}
}
