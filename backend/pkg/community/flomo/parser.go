package flomo

import (
	"archive/zip"
	"fmt"
	"io"
	"regexp"
	"strings"
)

var (
	reMemoTime         = regexp.MustCompile(`<div class="time">(.*?)</div>`)
	reContentWithFiles = regexp.MustCompile(`(?s)<div class="content">(.*?)</div>\s*<div class="files`)
	reContentSimple    = regexp.MustCompile(`(?s)<div class="content">(.*?)</div>\s*</div>`)
	reHTMLTag          = regexp.MustCompile(`<[^>]+>`)
	reFlomoTag         = regexp.MustCompile(`#[\p{Han}\w/]+`)
	reFileSrc          = regexp.MustCompile(`<img\s+src="(file/[^"]+)"`)
)

func ParseFlomoExport(zipPath string) ([]map[string]any, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}
	defer r.Close()

	var htmlContent string
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, ".html") {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("open %s: %w", f.Name, err)
			}
			data, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, fmt.Errorf("read %s: %w", f.Name, err)
			}
			htmlContent = string(data)
			break
		}
	}
	if htmlContent == "" {
		return nil, fmt.Errorf("no HTML file found in zip")
	}

	return parseFlomoHTML(htmlContent), nil
}

func parseFlomoHTML(html string) []map[string]any {
	parts := strings.Split(html, `<div class="memo">`)
	memos := make([]map[string]any, 0, len(parts)-1)

	for _, part := range parts[1:] {
		end := strings.Index(part, "</div>\n    </div>")
		if end == -1 {
			end = strings.Index(part, `<div class="memo">`)
			if end == -1 {
				end = len(part)
			}
		}
		fragment := part[:end]

		timeMatch := reMemoTime.FindStringSubmatch(fragment)
		if timeMatch == nil {
			continue
		}
		memoTime := strings.TrimSpace(timeMatch[1])

		contentMatch := reContentWithFiles.FindStringSubmatch(fragment)
		if contentMatch == nil {
			contentMatch = reContentSimple.FindStringSubmatch(fragment)
		}
		if contentMatch == nil {
			continue
		}
		contentHTML := strings.TrimSpace(contentMatch[1])

		textContent := reHTMLTag.ReplaceAllString(contentHTML, "")
		tagMatches := reFlomoTag.FindAllString(textContent, -1)
		tags := make([]any, len(tagMatches))
		for i, t := range tagMatches {
			tags[i] = t
		}

		fileMatches := reFileSrc.FindAllStringSubmatch(fragment, -1)
		files := make([]any, 0, len(fileMatches))
		for _, m := range fileMatches {
			files = append(files, m[1])
		}

		memos = append(memos, map[string]any{
			"content":         contentHTML,
			"tags":            tags,
			"files":           files,
			"memo_created_at": memoTime,
		})
	}

	for i, j := 0, len(memos)-1; i < j; i, j = i+1, j-1 {
		memos[i], memos[j] = memos[j], memos[i]
	}

	return memos
}
