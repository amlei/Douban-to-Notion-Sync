package douban

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const baseURL = "https://www.douban.com"

// Default headers matching Python scraper's DEFAULT_HEADERS.
var defaultHeaders = http.Header{
	"User-Agent": []string{
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
			"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
	},
	"Accept": []string{
		"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	},
}

// CookieEntry mirrors a single cookie from Playwright storage state JSON.
type CookieEntry struct {
	Name    string  `json:"name"`
	Value   string  `json:"value"`
	Domain  string  `json:"domain"`
	Path    string  `json:"path"`
	Expires float64 `json:"expires"`
	Secure  bool    `json:"secure"`
}

// SessionState mirrors the Playwright storage state JSON stored in DB.
type SessionState struct {
	Cookies []CookieEntry `json:"cookies"`
	Origins []any         `json:"origins"`
}

// DoubanClient wraps HTTP calls to Douban with cookie-based auth.
// Instead of net/http/cookiejar (which rejects quotes in cookie values),
// we build the Cookie header string manually — matching what Python's
// requests.Session does natively.
type DoubanClient struct {
	httpClient  *http.Client
	userID      string
	cookieHeader string // pre-built "name=val; name=val; ..." string
}

// HasValidSession checks if the dbcl2 cookie is present and not expired.
// Equivalent to Python's SessionManager.has_valid_session.
func HasValidSession(stateJSON string) bool {
	if stateJSON == "" {
		return false
	}
	var state SessionState
	if err := json.Unmarshal([]byte(stateJSON), &state); err != nil {
		return false
	}
	now := float64(time.Now().Unix())
	for _, c := range state.Cookies {
		if c.Name == "dbcl2" {
			return c.Expires > now
		}
	}
	return false
}

// NewDoubanClient builds a client from stored session state JSON.
// Cookies are stored as a raw header string to preserve values that
// net/http/cookiejar would reject (e.g. dbcl2 with embedded quotes).
func NewDoubanClient(stateJSON string) (*DoubanClient, error) {
	var state SessionState
	if err := json.Unmarshal([]byte(stateJSON), &state); err != nil {
		return nil, fmt.Errorf("parse session state: %w", err)
	}

	// Build cookie header string manually — no validation, no dropping.
	parts := make([]string, 0, len(state.Cookies))
	for _, c := range state.Cookies {
		parts = append(parts, c.Name+"="+c.Value)
	}

	return &DoubanClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("too many redirects")
				}
				// Preserve our custom Cookie header across redirects.
				if via[0].Header.Get("Cookie") != "" {
					req.Header.Set("Cookie", via[0].Header.Get("Cookie"))
				}
				return nil
			},
		},
		cookieHeader: strings.Join(parts, "; "),
	}, nil
}

// ExtractUserID tries to get the Douban user ID from the dbcl2 cookie value,
// falling back to fetching /mine/ and following the redirect.
func (c *DoubanClient) ExtractUserID(ctx context.Context) (string, error) {
	// Parse dbcl2 from our raw cookie string.
	for _, part := range strings.Split(c.cookieHeader, "; ") {
		if strings.HasPrefix(part, "dbcl2=") {
			raw := strings.TrimPrefix(part, "dbcl2=")
			// Value may be quoted: "\"215871379:abc\""
			raw = strings.Trim(raw, "\"")
			// dbcl2 value format: "userID:randomhex"
			if idx := strings.Index(raw, ":"); idx > 0 {
				uid := raw[:idx]
				if uid != "" {
					c.userID = uid
					return uid, nil
				}
			}
		}
	}

	// Fallback: follow /mine/ redirect.
	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/mine/", nil)
	if err != nil {
		return "", err
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch /mine/: %w", err)
	}
	defer resp.Body.Close()

	// Check the final URL after redirects.
	finalURL := resp.Request.URL.String()
	re := regexp.MustCompile(`/people/(\d+)`)
	m := re.FindStringSubmatch(finalURL)
	if len(m) >= 2 {
		c.userID = m[1]
		return m[1], nil
	}

	// Last resort: parse the response body for a redirect URL.
	body, _ := io.ReadAll(resp.Body)
	matches := re.FindAllStringSubmatch(string(body), -1)
	if len(matches) > 0 && len(matches[0]) >= 2 {
		c.userID = matches[0][1]
		return matches[0][1], nil
	}

	return "", fmt.Errorf("cannot extract user_id from URL: %s", finalURL)
}

// SetUserID sets the user ID explicitly (e.g. from community_user_id in DB).
func (c *DoubanClient) SetUserID(uid string) {
	c.userID = uid
}

// setHeaders applies default headers + cookie to the request.
func (c *DoubanClient) setHeaders(req *http.Request) {
	for k, v := range defaultHeaders {
		req.Header[k] = v
	}
	if c.cookieHeader != "" {
		req.Header.Set("Cookie", c.cookieHeader)
	}
}

// fetchPage fetches a URL and returns a parsed goquery.Document.
// Includes 3-retry logic with exponential backoff.
func (c *DoubanClient) fetchPage(ctx context.Context, pageURL string) (*goquery.Document, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			delay := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			log.Printf("[douban-go] retry %d for %s after %v", attempt, pageURL, delay)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, "GET", pageURL, nil)
		if err != nil {
			return nil, err
		}
		c.setHeaders(req)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("douban returned status %d: %s", resp.StatusCode, string(body))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("douban returned status %d: %s", resp.StatusCode, string(body))
		}

		doc, err := goquery.NewDocumentFromReader(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("parse HTML from %s: %w", pageURL, err)
		}
		return doc, nil
	}

	return nil, fmt.Errorf("fetch %s failed after 3 retries: %w", pageURL, lastErr)
}
