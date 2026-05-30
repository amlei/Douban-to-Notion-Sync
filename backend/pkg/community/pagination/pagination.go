package pagination

// PaginationRequest holds common pagination query parameters.
type PaginationRequest struct {
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
	Keyword   string `form:"keyword"`
	SortBy    string `form:"sort_by"`
	SortOrder string `form:"sort_order"` // "asc" or "desc"
}

// Defaults sets zero values to sensible defaults.
func (r *PaginationRequest) Defaults() {
	if r.Page < 1 {
		r.Page = 1
	}
	if r.PageSize < 1 || r.PageSize > 200 {
		r.PageSize = 20
	}
	if r.SortOrder != "asc" {
		r.SortOrder = "desc"
	}
}

// BookFilter holds book-specific filter parameters.
type BookFilter struct {
	PlatformID *int   `form:"platform_id"` // 1=douban, 2=weread
	Status     string `form:"status"`      // done, reading, unread
}

// BookmarkNoteFilter holds filter parameters for bookmarks and notes.
type BookmarkNoteFilter struct {
	BookID string `form:"book_id"`
}

// PaginatedResponse is the generic envelope for paginated results.
type PaginatedResponse struct {
	Items      []map[string]any `json:"items"`
	Total      int              `json:"total"`
	Page       int              `json:"page"`
	PageSize   int              `json:"page_size"`
	TotalPages int              `json:"total_pages"`
}

// EnsureItemsNotNil ensures Items is never nil (avoids JSON null).
func (r *PaginatedResponse) EnsureItemsNotNil() {
	if r.Items == nil {
		r.Items = []map[string]any{}
	}
}
