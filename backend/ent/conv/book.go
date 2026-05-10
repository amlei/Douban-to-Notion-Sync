package conv

import (
	"crypto/md5"
	"encoding/json"
	"fmt"

	"github.com/lifeink-ai/backend/ent"
)

func BookChangeHash(b *ent.Book) string {
	status := ""
	if b.Status != nil {
		status = *b.Status
	}
	rating := ""
	if b.Rating != nil {
		rating = fmt.Sprintf("%d", *b.Rating)
	}
	ext := ""
	if b.External != nil {
		ext = *b.External
	}
	payload := fmt.Sprintf("%s|%s|%s", status, rating, ext)
	return fmt.Sprintf("%x", md5.Sum([]byte(payload)))
}

const (
	PlatformDouban = 1
	PlatformWeread = 2
)

func BookToAPIDict(b *ent.Book) map[string]any {
	d := map[string]any{
		"platform_id": b.PlatformID,
		"title":       b.Title,
		"url":         b.URL,
		"cover":       b.Cover,
		"author":      b.Author,
		"translator":  b.Translator,
		"publisher":   b.Publisher,
		"price":       b.Price,
		"rating":      b.Rating,
		"status":      b.Status,
	}
	var ext map[string]any
	if b.External != nil {
		json.Unmarshal([]byte(*b.External), &ext)
	}
	if b.PlatformID == PlatformWeread {
		d["book_id"] = b.URL
		if ext != nil {
			for k, v := range ext {
				d[k] = v
			}
		}
	} else {
		var tags any
		if b.Tags != nil {
			json.Unmarshal([]byte(*b.Tags), &tags)
		}
		d["country"] = b.Country
		d["pub_date"] = b.PubDate
		d["read_date"] = b.ReadDate
		d["tags"] = tags
		d["comment"] = b.Comment
	}
	return d
}
