package repository

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type DestinationRepository struct {
	db *gorm.DB
}

func NewDestinationRepository(db *gorm.DB) *DestinationRepository {
	return &DestinationRepository{db: db}
}

// FindByID — used by BookingService for server-side price lookup —
// single source of truth for price, not the client value. Soft-deleted
// destinations are automatically not found (default gorm scope).
func (r *DestinationRepository) FindByID(ctx context.Context, id uint) (*models.Destination, error) {
	var destination models.Destination
	err := r.db.WithContext(ctx).First(&destination, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &destination, nil
}

type DestinationFilter struct {
	Search   string
	Category string
	MinPrice int64
	MaxPrice int64
}

func applyDestinationFilter(db *gorm.DB, f DestinationFilter) *gorm.DB {
	q := db
	if search := strings.TrimSpace(f.Search); search != "" {
		// Escape wildcards so user cannot inject % or _ into LIKE.
		escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(search)
		q = q.Where("name ILIKE ? ESCAPE '\\'", "%"+escaped+"%")
	}
	if category := strings.TrimSpace(f.Category); category != "" {
		q = q.Where("category = ?", category)
	}
	if f.MinPrice > 0 {
		q = q.Where("price >= ?", f.MinPrice)
	}
	if f.MaxPrice > 0 {
		q = q.Where("price <= ?", f.MaxPrice)
	}
	return q
}

// ratingExpr — DISPLAY rating of a destination (Batch 2 review/rating):
// if real reviews exist (count > 0), rating = average review; if none at
// all, fallback to old destinations.rating field (so new destinations don't
// start at 0/empty). Used in List, Meta, and WishlistRepository.ListByUser —
// one single source of truth.
const ratingExpr = "COALESCE((SELECT ROUND(AVG(rv.rating)::numeric, 1) FROM reviews rv WHERE rv.destination_id = destinations.id), destinations.rating) AS rating"

// listSelect — SELECT columns for destination list + meta. userID > 0 adds
// is_wishlisted column (subquery EXISTS with userID param); userID = 0
// (anonymous / without AuthOptional) does not include it at all.
func listSelect(userID uint) (string, []interface{}) {
	base := `destinations.id, destinations.name, destinations.category, destinations.description,
		destinations.price, ` + ratingExpr + `,
		destinations.image_url, destinations.deleted_at,
		(SELECT COUNT(*) FROM destination_images i WHERE i.destination_id = destinations.id) AS images_count`
	if userID > 0 {
		base += `, EXISTS(SELECT 1 FROM wishlists w WHERE w.destination_id = destinations.id AND w.user_id = ?) AS is_wishlisted`
		return base, []interface{}{userID}
	}
	return base, nil
}

// List — userID used to compute is_wishlisted per row; 0 for anonymous
// requests (is_wishlisted field not populated → omitempty).
func (r *DestinationRepository) List(ctx context.Context, f DestinationFilter, page, limit int, userID uint) ([]models.DestinationListItem, error) {
	var items []models.DestinationListItem
	q := applyDestinationFilter(r.db.WithContext(ctx).Model(&models.Destination{}), f)
	selectCols, args := listSelect(userID)
	q = q.Select(selectCols, args...)
	q = q.Order("destinations.id ASC")
	if limit > 0 {
		q = q.Limit(limit).Offset((page - 1) * limit)
	}
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// Trending — most popular destinations for Gari widget (MVP). Sorted by
// booking COUNT (transactions, status != FAILED). Destinations with zero
// bookings also appear as fallback (LEFT JOIN → COUNT = 0) sorted by
// highest rating first, so the list is never empty at launch.
func (r *DestinationRepository) Trending(ctx context.Context, limit int, userID uint) ([]models.DestinationListItem, error) {
	var items []models.DestinationListItem
	selectCols, args := listSelect(userID)
	q := r.db.WithContext(ctx).Model(&models.Destination{}).
		Select(selectCols, args...).
		Joins("LEFT JOIN transactions ON transactions.destination_id = destinations.id AND transactions.status <> ?", models.StatusFailed).
		Group("destinations.id").
		Order("COUNT(transactions.id) DESC, destinations.rating DESC, destinations.id ASC").
		Limit(limit)
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *DestinationRepository) Count(ctx context.Context, f DestinationFilter) (int64, error) {
	var total int64
	q := applyDestinationFilter(r.db.WithContext(ctx).Model(&models.Destination{}), f)
	if err := q.Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func (r *DestinationRepository) Create(ctx context.Context, destination *models.Destination) error {
	return r.db.WithContext(ctx).Create(destination).Error
}

func (r *DestinationRepository) Update(ctx context.Context, destination *models.Destination) error {
	return r.db.WithContext(ctx).Save(destination).Error
}

// Delete = SOFT delete (set deleted_at). Used for destinations with booking
// history — row must not disappear permanently because transactions
// reference it (FK RESTRICT + archive).
func (r *DestinationRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Destination{}, id).Error
}

// DeletePermanent = HARD delete (unscoped). Only called after confirming
// NO booking references this destination.
func (r *DestinationRepository) DeletePermanent(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Unscoped().Delete(&models.Destination{}, id).Error
}

func (r *DestinationRepository) CreateImage(ctx context.Context, image *models.DestinationImage) error {
	return r.db.WithContext(ctx).Create(image).Error
}

func (r *DestinationRepository) ListImages(ctx context.Context, destinationID uint) ([]models.DestinationImage, error) {
	var images []models.DestinationImage
	err := r.db.WithContext(ctx).
		Where("destination_id = ?", destinationID).
		Order("sort_order ASC, id ASC").
		Find(&images).Error
	return images, err
}

func (r *DestinationRepository) FindImage(ctx context.Context, id uint) (*models.DestinationImage, error) {
	var image models.DestinationImage
	err := r.db.WithContext(ctx).First(&image, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &image, nil
}

func (r *DestinationRepository) DeleteImage(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.DestinationImage{}, id).Error
}

// Meta — DISPLAY rating (real reviews if any, fallback to old field) +
// is_wishlisted for 1 destination. Called by service Get so detail response
// is consistent with list. userID 0 = anonymous (is_wishlisted false).
func (r *DestinationRepository) Meta(ctx context.Context, id uint, userID uint) (rating float64, isWishlisted bool, err error) {
	var out struct {
		Rating       float64
		IsWishlisted bool
	}
	if userID > 0 {
		err = r.db.WithContext(ctx).Table("destinations").
			Select("COALESCE((SELECT ROUND(AVG(rv.rating)::numeric, 1) FROM reviews rv WHERE rv.destination_id = destinations.id), destinations.rating) AS rating, EXISTS(SELECT 1 FROM wishlists w WHERE w.destination_id = destinations.id AND w.user_id = ?) AS is_wishlisted", userID).
			Where("destinations.id = ? AND destinations.deleted_at IS NULL", id).
			Scan(&out).Error
		if err != nil {
			return 0, false, err
		}
		return out.Rating, out.IsWishlisted, nil
	}
	err = r.db.WithContext(ctx).Table("destinations").
		Select("COALESCE((SELECT ROUND(AVG(rv.rating)::numeric, 1) FROM reviews rv WHERE rv.destination_id = destinations.id), destinations.rating) AS rating").
		Where("destinations.id = ? AND destinations.deleted_at IS NULL", id).
		Scan(&out).Error
	if err != nil {
		return 0, false, err
	}
	return out.Rating, false, nil
}
