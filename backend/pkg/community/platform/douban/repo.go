package douban

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/uptrace/bun"
)

type DoubanRepo struct {
	db *bun.DB
}

func NewDoubanRepo(db *bun.DB) *DoubanRepo {
	return &DoubanRepo{db: db}
}

func (r *DoubanRepo) UpsertMovies(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		movie := movieRowFromMap(item)
		movie.UserID = userID
		_, err := r.db.NewInsert().Model(movie).
			On("CONFLICT (user_id, url) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, release_date = EXCLUDED.release_date, rating = EXCLUDED.rating, watch_date = EXCLUDED.watch_date, tags = EXCLUDED.tags, comment = EXCLUDED.comment").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *DoubanRepo) UpsertGames(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		game := gameRowFromMap(item)
		game.UserID = userID
		_, err := r.db.NewInsert().Model(game).
			On("CONFLICT (user_id, url) DO UPDATE").
			Set("title = EXCLUDED.title, cover = EXCLUDED.cover, description = EXCLUDED.description, rating = EXCLUDED.rating, release_date = EXCLUDED.release_date, play_date = EXCLUDED.play_date, tags = EXCLUDED.tags, comment = EXCLUDED.comment").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *DoubanRepo) UpsertReviews(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		review := reviewRowFromMap(item)
		review.UserID = userID
		_, err := r.db.NewInsert().Model(review).
			On("CONFLICT (user_id, review_url) DO UPDATE").
			Set("subject_title = EXCLUDED.subject_title, subject_url = EXCLUDED.subject_url, subject_img_url = EXCLUDED.subject_img_url, review_title = EXCLUDED.review_title, date = EXCLUDED.date").
			Exec(ctx)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *DoubanRepo) GetMovies(ctx context.Context, userID int64) ([]MovieRow, error) {
	var movies []MovieRow
	err := r.db.NewSelect().Model(&movies).Where("user_id = ?", userID).Scan(ctx)
	return movies, err
}

func (r *DoubanRepo) GetGames(ctx context.Context, userID int64) ([]GameRow, error) {
	var games []GameRow
	err := r.db.NewSelect().Model(&games).Where("user_id = ?", userID).Scan(ctx)
	return games, err
}

func (r *DoubanRepo) GetReviews(ctx context.Context, userID int64) ([]ReviewRow, error) {
	var reviews []ReviewRow
	err := r.db.NewSelect().Model(&reviews).Where("user_id = ?", userID).Scan(ctx)
	return reviews, err
}

func movieRowFromMap(m map[string]any) *MovieRow {
	return &MovieRow{
		Title:       fmt.Sprintf("%v", m["title"]),
		URL:         fmt.Sprintf("%v", m["url"]),
		Cover:       getStr(m, "cover"),
		ReleaseDate: getStr(m, "release_date"),
		Rating:      getInt(m, "rating"),
		WatchDate:   getStr(m, "watch_date"),
		Tags:        getJSONStr(m, "tags"),
		Comment:     getStr(m, "comment"),
	}
}

func gameRowFromMap(m map[string]any) *GameRow {
	return &GameRow{
		Title:       fmt.Sprintf("%v", m["title"]),
		URL:         fmt.Sprintf("%v", m["url"]),
		Cover:       getStr(m, "cover"),
		Description: getStr(m, "desc"),
		Rating:      getInt(m, "rating"),
		ReleaseDate: getStr(m, "release_date"),
		PlayDate:    getStr(m, "play_date"),
		Tags:        getJSONStr(m, "tags"),
		Comment:     getStr(m, "comment"),
	}
}

func reviewRowFromMap(m map[string]any) *ReviewRow {
	return &ReviewRow{
		SubjectTitle:  fmt.Sprintf("%v", m["subject_title"]),
		SubjectURL:    getStr(m, "subject_url"),
		SubjectImgURL: getStr(m, "subject_img_url"),
		ReviewTitle:   getStr(m, "review_title"),
		ReviewURL:     getStr(m, "review_url"),
		Date:          getStr(m, "date"),
	}
}

func getStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		s := fmt.Sprintf("%v", v)
		return &s
	}
	return nil
}

func getInt(m map[string]any, key string) *int {
	if v, ok := m[key]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int(n)
			return &i
		case int:
			return &n
		}
	}
	return nil
}

func getJSONStr(m map[string]any, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		b, _ := json.Marshal(v)
		s := string(b)
		return &s
	}
	return nil
}
