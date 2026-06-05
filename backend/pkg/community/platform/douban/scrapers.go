package douban

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

// ---------------------------------------------------------------------------
// Helpers (porting from Python base.py, books.py, movies.py, games.py)
// ---------------------------------------------------------------------------

// clean removes all whitespace from a string, returns nil for empty.
// Direct port of Python's base.clean().
func clean(s string) *string {
	re := regexp.MustCompile(`\s+`)
	cleaned := re.ReplaceAllString(s, "")
	if cleaned == "" {
		return nil
	}
	return &cleaned
}

// cleanText returns the cleaned text content of a selection, or nil.
func cleanText(s *goquery.Selection) *string {
	if s.Length() == 0 {
		return nil
	}
	return clean(s.Text())
}

// parseRating extracts a rating (1-5) from CSS class names.
// Matches patterns like "rating3" (books/movies) and "allstar30"/"allstar40" (games).
func parseRating(className string) *int {
	// Books/movies: "rating3"
	re := regexp.MustCompile(`rating(\d)`)
	if m := re.FindStringSubmatch(className); len(m) >= 2 {
		v := int(m[1][0] - '0')
		return &v
	}
	// Games: "allstar30", "allstar40", etc.
	re2 := regexp.MustCompile(`allstar(\d)0`)
	if m := re2.FindStringSubmatch(className); len(m) >= 2 {
		v := int(m[1][0] - '0')
		return &v
	}
	return nil
}

// pubInfo holds parsed publication metadata from a book listing.
type pubInfo struct {
	Author     *string
	Translator *string
	Publisher  *string
	PubDate    *string
	Price      *string
	Country    *string
}

// parsePubInfo parses the publication info string from book listings.
// Format varies: "Author / Translator / Publisher / Date / Price" (5 parts),
// or shorter variants. Port of Python's books._parse_pub.
func parsePubInfo(text string) pubInfo {
	parts := strings.Split(text, "/")
	for i := range parts {
		trimmed := strings.TrimSpace(parts[i])
		parts[i] = trimmed
	}
	n := len(parts)
	info := pubInfo{}

	if n >= 1 {
		info.Author = strPtr(parts[0])
	}
	if n == 5 {
		info.Translator = strPtr(parts[1])
		info.Publisher = strPtr(parts[2])
		info.PubDate = strPtr(parts[3])
		info.Price = strPtr(parts[4])
	} else if n == 4 {
		info.Publisher = strPtr(parts[1])
		info.PubDate = strPtr(parts[2])
		info.Price = strPtr(parts[3])
	} else if n >= 3 {
		info.Publisher = strPtr(parts[1])
		info.PubDate = strPtr(parts[2])
	} else if n == 2 {
		info.PubDate = strPtr(parts[1])
	}

	// Extract country from author.
	if info.Author != nil {
		country, author := extractCountry(*info.Author)
		info.Country = country
		if author != nil {
			info.Author = author
		}
	}

	return info
}

// extractCountry parses "[Country]Author" or "【Country】Author" format.
// Port of Python's books._extract_country.
func extractCountry(author string) (*string, *string) {
	re := regexp.MustCompile(`^[\[【](.+?)[\]】]\s*(.*)`)
	m := re.FindStringSubmatch(author)
	if len(m) >= 3 {
		country := m[1]
		if !strings.Contains(country, "国") {
			country += "国"
		}
		rest := strings.TrimSpace(m[2])
		if rest == "" {
			return &country, nil
		}
		return &country, &rest
	}
	// Default: Chinese author.
	return strPtr("中国"), &author
}

// dateStatus holds parsed read date and reading status.
type dateStatus struct {
	Date   *string
	Status *string
}

// parseDateStatus extracts read date and status from text containing
// "读过"/"在读"/"想读" keywords. Port of books._parse_date_status.
func parseDateStatus(text string) dateStatus {
	result := dateStatus{}
	if text == "" {
		return result
	}
	re := regexp.MustCompile(`(读过|在读|想读)`)
	if m := re.FindStringSubmatch(text); len(m) >= 2 {
		result.Status = &m[1]
	}
	// Remove the status keyword and trim.
	date := re.ReplaceAllString(text, "")
	date = strings.TrimSpace(date)
	if date != "" {
		result.Date = &date
	}
	return result
}

// getTotalPages reads the paginator element to find the total page count.
// Port of Python's BaseScraper._get_total_pages.
func getTotalPages(doc *goquery.Document) int {
	paginator := doc.Find(".paginator")
	if paginator.Length() == 0 {
		return 1
	}
	links := paginator.Find("a")
	if links.Length() == 0 {
		return 1
	}
	lastText := strings.TrimSpace(links.Last().Text())
	var lastNum int
	if err := parseInt(lastText, &lastNum); err == nil {
		return lastNum
	}
	return 1
}

// ---------------------------------------------------------------------------
// Scraper functions
// ---------------------------------------------------------------------------

// ScrapeProfile parses the user profile page.
// Port of Python's ProfileScraper.
func ScrapeProfile(doc *goquery.Document, userID string) map[string]any {
	// Name: first text node in h1 (signature div is nested inside h1).
	name := (*string)(nil)
	h1 := doc.Find("h1")
	if h1.Length() > 0 {
		h1.Contents().EachWithBreak(func(i int, s *goquery.Selection) bool {
			if s.Nodes[0].Type == html.TextNode {
				t := strings.TrimSpace(s.Text())
				if t != "" {
					name = &t
					return false
				}
			}
			return true
		})
	}

	// Avatar.
	avatar := (*string)(nil)
	if img := doc.Find(".basic-info img.userface"); img.Length() > 0 {
		if src, exists := img.Attr("src"); exists {
			avatar = &src
		}
	}

	// Signature.
	signature := (*string)(nil)
	if sigDisplay := doc.Find("#edit_signature #display"); sigDisplay.Length() > 0 {
		t := strings.TrimSpace(sigDisplay.Text())
		if t != "" {
			signature = &t
		}
	}

	// Bio.
	bio := (*string)(nil)
	if introDisplay := doc.Find("#edit_intro #intro_display"); introDisplay.Length() > 0 {
		t := strings.TrimSpace(introDisplay.Text())
		if t != "" {
			bio = &t
		}
	}

	// Join date and location.
	joinDate := (*string)(nil)
	location := (*string)(nil)
	userInfoPL := doc.Find(".user-info .pl")
	if userInfoPL.Length() > 0 {
		text := userInfoPL.Text()
		if m := regexp.MustCompile(`(\d{4}-\d{2}-\d{2})加入`).FindStringSubmatch(text); len(m) >= 2 {
			joinDate = &m[1]
		}
		if m := regexp.MustCompile(`IP属地：(\S+)`).FindStringSubmatch(text); len(m) >= 2 {
			location = &m[1]
		}
	}

	return map[string]any{
		"user_id":   userID,
		"name":      derefStr(name),
		"avatar":    derefStr(avatar),
		"signature": derefStr(signature),
		"bio":       derefStr(bio),
		"join_date": derefStr(joinDate),
		"location":  derefStr(location),
	}
}

// ScrapeBooks parses a single page of book listings.
// Port of Python's BooksScraper._parse_page.
func ScrapeBooks(doc *goquery.Document) []map[string]any {
	var books []map[string]any

	doc.Find(".subject-item").Each(func(i int, el *goquery.Selection) {
		titleEl := el.Find("h2 a")
		title := cleanText(titleEl)
		if title != nil {
			// Split on "/" and take first part.
			parts := strings.Split(*title, "/")
			t := strings.TrimSpace(parts[0])
			title = &t
		}
		url := attrStr(titleEl, "href")

		cover := attrStr(el.Find(".pic img"), "src")

		pubEl := el.Find(".pub")
		var info pubInfo
		if pubEl.Length() > 0 {
			info = parsePubInfo(strings.TrimSpace(pubEl.Text()))
		}

		ratingEl := el.Find("[class*=rating]")
		var rating *int
		if ratingEl.Length() > 0 {
			cls, _ := ratingEl.Attr("class")
			rating = parseRating(cls)
		}

		dateEl := el.Find(".date")
		ds := dateStatus{}
		if dateEl.Length() > 0 {
			ds = parseDateStatus(dateEl.Text())
		}

		tagsEl := el.Find(".tags")
		var tags []string
		if tagsEl.Length() > 0 {
			tagText := strings.TrimSpace(tagsEl.Text())
			tagText = strings.ReplaceAll(tagText, "标签: ", "")
			for _, t := range strings.Fields(tagText) {
				tags = append(tags, t)
			}
		}

		commentEl := el.Find(".comment")
		comment := cleanText(commentEl)

		item := map[string]any{
			"title":      derefStr(title),
			"url":        derefStr(url),
			"cover":      derefStr(cover),
			"author":     derefStr(info.Author),
			"country":    derefStr(info.Country),
			"translator": derefStr(info.Translator),
			"publisher":  derefStr(info.Publisher),
			"pub_date":   derefStr(info.PubDate),
			"price":      derefStr(info.Price),
			"rating":     derefIntPtr(rating),
			"read_date":  derefStr(ds.Date),
			"status":     derefStr(ds.Status),
			"tags":       tags,
			"comment":    derefStr(comment),
		}
		books = append(books, item)
	})

	return books
}

// ScrapeMovies parses a single page of movie listings.
// Port of Python's MoviesScraper._parse_page.
func ScrapeMovies(doc *goquery.Document) []map[string]any {
	var movies []map[string]any

	doc.Find(".item").Each(func(i int, el *goquery.Selection) {
		titleEl := el.Find(".title a")
		title := cleanText(titleEl)
		if title != nil {
			parts := strings.Split(*title, "/")
			t := strings.TrimSpace(parts[0])
			title = &t
		}
		movieURL := attrStr(titleEl, "href")

		cover := attrStr(el.Find(".pic img"), "src")

		introEl := el.Find(".intro")
		releaseDate := (*string)(nil)
		if introEl.Length() > 0 {
			introText := strings.TrimSpace(introEl.Text())
			if introText != "" {
				// Take first part before "/" and "(".
				parts := strings.Split(introText, "/")
				datePart := strings.Split(strings.TrimSpace(parts[0]), "(")[0]
				datePart = strings.TrimSpace(datePart)
				if datePart != "" {
					releaseDate = &datePart
				}
			}
		}

		ratingEl := el.Find("[class*=rating]")
		var rating *int
		if ratingEl.Length() > 0 {
			cls, _ := ratingEl.Attr("class")
			rating = parseRating(cls)
		}

		dateEl := el.Find(".date")
		watchDate := cleanText(dateEl)

		tagsEl := el.Find(".tags")
		var tags []string
		if tagsEl.Length() > 0 {
			tagText := strings.TrimSpace(tagsEl.Text())
			tagText = strings.ReplaceAll(tagText, "标签: ", "")
			for _, t := range strings.Fields(tagText) {
				tags = append(tags, t)
			}
		}

		commentEl := el.Find(".comment")
		comment := cleanText(commentEl)

		item := map[string]any{
			"title":        derefStr(title),
			"url":          derefStr(movieURL),
			"cover":        derefStr(cover),
			"release_date": derefStr(releaseDate),
			"rating":       derefIntPtr(rating),
			"watch_date":   derefStr(watchDate),
			"tags":         tags,
			"comment":      derefStr(comment),
		}
		movies = append(movies, item)
	})

	return movies
}

// ScrapeGames parses the games page (single page).
// Port of Python's GamesScraper._parse_page.
func ScrapeGames(doc *goquery.Document) []map[string]any {
	var games []map[string]any

	doc.Find(".common-item").Each(func(i int, el *goquery.Selection) {
		titleEl := el.Find(".title a")
		title := cleanText(titleEl)
		if title != nil {
			parts := strings.Split(*title, "/")
			t := strings.TrimSpace(parts[0])
			title = &t
		}
		gameURL := attrStr(titleEl, "href")

		cover := attrStr(el.Find(".pic img"), "src")

		descEl := el.Find(".desc")
		desc := cleanText(descEl)

		ratingEl := el.Find(".rating-star")
		var rating *int
		if ratingEl.Length() > 0 {
			cls, _ := ratingEl.Attr("class")
			rating = parseRating(cls)
		}

		dateEl := el.Find(".date")
		playDate := cleanText(dateEl)

		tagsEl := el.Find(".tags")
		var tags []string
		if tagsEl.Length() > 0 {
			tagText := strings.TrimSpace(tagsEl.Text())
			tagText = strings.ReplaceAll(tagText, "标签: ", "")
			for _, t := range strings.Fields(tagText) {
				tags = append(tags, t)
			}
		}

		comment := extractGameComment(el)

		item := map[string]any{
			"title":   derefStr(title),
			"url":     derefStr(gameURL),
			"cover":   derefStr(cover),
			"desc":    derefStr(desc),
			"rating":  derefIntPtr(rating),
			"play_date": derefStr(playDate),
			"tags":    tags,
			"comment": derefStr(comment),
		}
		games = append(games, item)
	})

	return games
}

// extractGameComment extracts the comment text from a game listing.
// The comment is a direct child div of .content that does NOT have
// class "title", "desc", or "user-operation".
// Port of Python's GamesScraper._extract_game_comment.
func extractGameComment(el *goquery.Selection) *string {
	content := el.Find(".content")
	if content.Length() == 0 {
		return nil
	}
	// Iterate direct children, find first div without excluded classes.
	found := content.ChildrenFiltered("div").FilterFunction(func(i int, s *goquery.Selection) bool {
		cls, _ := s.Attr("class")
		return !strings.Contains(cls, "title") &&
			!strings.Contains(cls, "desc") &&
			!strings.Contains(cls, "user-operation")
	})
	if found.Length() == 0 {
		return nil
	}
	t := strings.TrimSpace(found.First().Text())
	if t == "" {
		return nil
	}
	return &t
}

// ScrapeReviews parses a single page of reviews.
// Port of Python's ReviewsScraper._parse_page.
func ScrapeReviews(doc *goquery.Document) []map[string]any {
	var reviews []map[string]any
	dateRe := regexp.MustCompile(`(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})`)

	doc.Find(".review-item").Each(func(i int, el *goquery.Selection) {
		subjectImg := el.Find(".subject-img img")
		subjectTitle := attrStr(subjectImg, "title")
		subjectURL := attrStr(el.Find(".subject-img"), "href")
		subjectImgURL := attrStr(subjectImg, "src")

		h2a := el.Find("h2 a")
		reviewTitle := cleanText(h2a)
		reviewURL := attrStr(h2a, "href")

		// Extract date from full element text.
		allText := el.Text()
		date := (*string)(nil)
		if m := dateRe.FindStringSubmatch(allText); len(m) >= 2 {
			date = &m[1]
		}

		item := map[string]any{
			"subject_title":   derefStr(subjectTitle),
			"subject_url":     derefStr(subjectURL),
			"subject_img_url": derefStr(subjectImgURL),
			"review_title":    derefStr(reviewTitle),
			"review_url":      derefStr(reviewURL),
			"date":            derefStr(date),
		}
		reviews = append(reviews, item)
	})

	return reviews
}

// ScrapeNotes parses a single page of notes.
// Port of Python's NotesScraper._parse_page.
func ScrapeNotes(doc *goquery.Document) []map[string]any {
	var notes []map[string]any

	doc.Find(".note-item").Each(func(i int, el *goquery.Selection) {
		a := el.Find(".note-title a")
		title := cleanText(a)
		noteURL := attrStr(a, "href")

		dateEl := el.Find(".note-date")
		date := cleanText(dateEl)

		locationEl := el.Find(".note-location")
		location := cleanText(locationEl)

		bodyEl := el.Find(".note-body")
		body := (*string)(nil)
		if bodyEl.Length() > 0 {
			t := strings.TrimSpace(bodyEl.Text())
			if t != "" {
				body = &t
			}
		}

		item := map[string]any{
			"title":    derefStr(title),
			"url":      derefStr(noteURL),
			"date":     derefStr(date),
			"location": derefStr(location),
			"body":     derefStr(body),
		}
		notes = append(notes, item)
	})

	return notes
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

func strPtr(s string) *string { return &s }

func derefStr(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

func derefIntPtr(i *int) any {
	if i == nil {
		return nil
	}
	return *i
}

func attrStr(s *goquery.Selection, attr string) *string {
	if s.Length() == 0 {
		return nil
	}
	v, exists := s.Attr(attr)
	if !exists {
		return nil
	}
	return &v
}

func parseInt(s string, out *int) error {
	for _, c := range s {
		if c < '0' || c > '9' {
			return fmt.Errorf("not a number: %s", s)
		}
	}
	if s == "" {
		return fmt.Errorf("empty string")
	}
	*out = 0
	for _, c := range s {
		*out = *out*10 + int(c-'0')
	}
	return nil
}
