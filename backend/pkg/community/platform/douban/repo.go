package douban

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	entsql "entgo.io/ent/dialect/sql"

	"github.com/lifeink-ai/backend/ent"
	"github.com/lifeink-ai/backend/ent/game"
	"github.com/lifeink-ai/backend/ent/movie"
	"github.com/lifeink-ai/backend/ent/review"

	platform "github.com/lifeink-ai/backend/pkg/community/pagination"
)

type DoubanRepo struct {
	client *ent.Client
	db     *sql.DB
}

func NewDoubanRepo(client *ent.Client, db *sql.DB) *DoubanRepo {
	return &DoubanRepo{client: client, db: db}
}

func (r *DoubanRepo) UpsertMovies(ctx context.Context, userID int64, items []map[string]any) (int, error) {
	count := 0
	for _, item := range items {
		title := fmt.Sprintf("%v", item["title"])
		url := fmt.Sprintf("%v", item["url"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO movies (user_id, title, url, cover, release_date, rating, watch_date, tags, comment, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			ON CONFLICT (user_id, url) DO UPDATE SET
				title = EXCLUDED.title, cover = EXCLUDED.cover, release_date = EXCLUDED.release_date,
				rating = EXCLUDED.rating, watch_date = EXCLUDED.watch_date, tags = EXCLUDED.tags, comment = EXCLUDED.comment`,
			userID, title, url,
			getStr(item, "cover"), getStr(item, "release_date"), getInt(item, "rating"),
			getStr(item, "watch_date"), getJSONStr(item, "tags"), getStr(item, "comment"),
			time.Now(),
		)
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
		title := fmt.Sprintf("%v", item["title"])
		url := fmt.Sprintf("%v", item["url"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO games (user_id, title, url, cover, description, rating, release_date, play_date, tags, comment, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			ON CONFLICT (user_id, url) DO UPDATE SET
				title = EXCLUDED.title, cover = EXCLUDED.cover, description = EXCLUDED.description,
				rating = EXCLUDED.rating, release_date = EXCLUDED.release_date, play_date = EXCLUDED.play_date,
				tags = EXCLUDED.tags, comment = EXCLUDED.comment`,
			userID, title, url,
			getStr(item, "cover"), getStr(item, "desc"), getInt(item, "rating"),
			getStr(item, "release_date"), getStr(item, "play_date"),
			getJSONStr(item, "tags"), getStr(item, "comment"),
			time.Now(),
		)
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
		subjectTitle := fmt.Sprintf("%v", item["subject_title"])
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO reviews (user_id, subject_title, subject_url, subject_img_url, review_title, review_url, date, scraped_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (user_id, review_url) DO UPDATE SET
				subject_title = EXCLUDED.subject_title, subject_url = EXCLUDED.subject_url,
				subject_img_url = EXCLUDED.subject_img_url, review_title = EXCLUDED.review_title, date = EXCLUDED.date`,
			userID, subjectTitle,
			getStr(item, "subject_url"), getStr(item, "subject_img_url"),
			getStr(item, "review_title"), getStr(item, "review_url"), getStr(item, "date"),
			time.Now(),
		)
		if err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

func (r *DoubanRepo) GetMovies(ctx context.Context, userID int64) ([]*ent.Movie, error) {
	return r.client.Movie.Query().
		Where(movie.UserIDEQ(userID)).
		All(ctx)
}

func (r *DoubanRepo) GetGames(ctx context.Context, userID int64) ([]*ent.Game, error) {
	return r.client.Game.Query().
		Where(game.UserIDEQ(userID)).
		All(ctx)
}

func (r *DoubanRepo) GetReviews(ctx context.Context, userID int64) ([]*ent.Review, error) {
	return r.client.Review.Query().
		Where(review.UserIDEQ(userID)).
		All(ctx)
}

// GetPaginatedMovies returns a paginated, filtered, sorted list of movies.
func (r *DoubanRepo) GetPaginatedMovies(
	ctx context.Context,
	userID int64,
	req platform.PaginationRequest,
) (*platform.PaginatedResponse, error) {
	query := r.client.Movie.Query().Where(movie.UserIDEQ(userID))

	if req.Keyword != "" {
		query = query.Where(movie.TitleContainsFold(req.Keyword))
	}

	total, err := query.Count(ctx)
	if err != nil {
		return nil, err
	}

	query = query.Order(movieOrderBy(req.SortBy, req.SortOrder)).
		Limit(req.PageSize).
		Offset((req.Page - 1) * req.PageSize)

	movies, err := query.All(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]any, len(movies))
	for i, m := range movies {
		items[i] = MovieToAPIDict(m)
	}

	return &platform.PaginatedResponse{
		Items:      items,
		Total:      total,
		Page:       req.Page,
		PageSize:   req.PageSize,
		TotalPages: (total + req.PageSize - 1) / req.PageSize,
	}, nil
}

func movieOrderBy(sortBy, sortOrder string) movie.OrderOption {
	dir := entsql.OrderDesc()
	if sortOrder == "asc" {
		dir = entsql.OrderAsc()
	}
	switch sortBy {
	case "title":
		return movie.ByTitle(dir)
	case "rating":
		return movie.ByRating(dir)
	case "watch_date":
		return movie.ByWatchDate(dir)
	default:
		return movie.ByScrapedAt(dir)
	}
}
