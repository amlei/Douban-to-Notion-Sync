package openai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// LLMConfig holds configuration for the OpenAI-compatible API.
type LLMConfig struct {
	APIKey  string `yaml:"api_key" json:"api_key"`
	BaseURL string `yaml:"base_url" json:"base_url"`
	Model   string `yaml:"model" json:"model"`
}


// Message represents a chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest is the request body sent to the API.
type ChatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream,omitempty"`
}

// ChatResponse is the non-streaming response from the API.
type ChatResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

// Choice represents a single choice in the response.
type Choice struct {
	Index   int     `json:"index"`
	Message Message `json:"message"`
	// FinishReason is populated in both streaming and non-streaming responses.
	FinishReason *string `json:"finish_reason,omitempty"`
}

// Usage holds token usage information.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ChatChunk is a single SSE chunk in a streaming response.
type ChatChunk struct {
	ID      string        `json:"id"`
	Choices []ChunkChoice `json:"choices"`
}

// ChunkChoice is a choice within a streaming chunk.
type ChunkChoice struct {
	Index         int   `json:"index"`
	Delta         Delta `json:"delta"`
	FinishReason  *string `json:"finish_reason,omitempty"`
}

// Delta represents the incremental content in a streaming chunk.
type Delta struct {
	Role             string `json:"role,omitempty"`
	Content          string `json:"content,omitempty"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// Client is an OpenAI-compatible HTTP client.
type Client struct {
	cfg LLMConfig
	http *http.Client
}

// NewClient creates a new Client with the given configuration.
func NewClient(cfg LLMConfig) *Client {
	return &Client{
		cfg:   cfg,
		http:  &http.Client{},
	}
}

// Chat sends a non-streaming chat completion request.
func (c *Client) Chat(ctx context.Context, messages []Message) (*ChatResponse, error) {
	body := ChatRequest{
		Model:    c.cfg.Model,
		Messages: messages,
	}

	b, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+"/chat/completions", bytes.NewReader(b))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, respBody)
	}

	var result ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &result, nil
}

// ChatStream sends a streaming chat completion request. It calls onDelta for
// each content fragment and onReasoning for each reasoning fragment received
// from the SSE stream.
func (c *Client) ChatStream(ctx context.Context, messages []Message, onDelta func(string), onReasoning func(string)) error {
	body := ChatRequest{
		Model:    c.cfg.Model,
		Messages: messages,
		Stream:   true,
	}

	b, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+"/chat/completions", bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.cfg.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, respBody)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()

		// SSE lines start with "data: "
		if len(line) < 6 || line[:6] != "data: " {
			continue
		}
		data := line[6:]

		// Stream termination signal
		if data == "[DONE]" {
			break
		}

		var chunk ChatChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		for _, choice := range chunk.Choices {
			if choice.Delta.ReasoningContent != "" {
				onReasoning(choice.Delta.ReasoningContent)
			}
			if choice.Delta.Content != "" {
				onDelta(choice.Delta.Content)
			}
		}
	}

	return scanner.Err()
}
