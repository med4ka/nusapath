package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type WishlistRepository struct {
	db *gorm.DB
}

func NewWishlistRepository(db *gorm.DB) *WishlistRepository {
	return &WishlistRepository{db: db}
}

func (r *WishlistRepository) Find(ctx context.Context, userID, destinationID uint) (*models.Wishlist, error) {
	var wishlist models.Wishlist
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND destination_id = ?", userID, destinationID).
		First(&wishlist).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &wishlist, nil
}

func (r *WishlistRepository) Create(ctx context.Context, wishlist *models.Wishlist) error {
	return r.db.WithContext(ctx).Create(wishlist).Error
}

func (r *WishlistRepository) DeleteByUserAndDestination(ctx context.Context, userID, destinationID uint) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND destination_id = ?", userID, destinationID).
		Delete(&models.Wishlist{}).Error
}

// ListByUser — destinations wishlisted by user, JOIN to destinations.
// Soft-deleted destinations automatically excluded (default scope JOIN makes
// wishlist rows for deleted destinations not found). Rating RE-COMPUTED from
// real reviews if any (consistent with GET /api/destinations), so wishlist
// UI does not show stale rating.
func (r *WishlistRepository) ListByUser(ctx context.Context, userID uint) ([]models.WishlistItem, error) {
	var items []models.WishlistItem
	selectCols := `
		d.id, d.name, d.category, d.description, d.price,
		COALESCE((SELECT ROUND(AVG(rv.rating)::numeric, 1) FROM reviews rv WHERE rv.destination_id = d.id), d.rating) AS rating,
		d.image_url, d.deleted_at,
		w.id AS wishlist_id, w.created_at AS wishlist_created_at,
		(SELECT COUNT(*) FROM destination_images i WHERE i.destination_id = d.id) AS images_count`
	err := r.db.WithContext(ctx).
		Table("wishlists w").
		Select(selectCols).
		Joins("JOIN destinations d ON d.id = w.destination_id").
		Where("w.user_id = ?", userID).
		Order("w.created_at DESC").
		Scan(&items).Error
	if err != nil {
		return nil, err
	}
	return items, nil
}