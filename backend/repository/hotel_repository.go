package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type HotelRepository struct {
	db *gorm.DB
}

func NewHotelRepository(db *gorm.DB) *HotelRepository {
	return &HotelRepository{db: db}
}

func (r *HotelRepository) FindByID(ctx context.Context, id uint) (*models.Hotel, error) {
	var hotel models.Hotel
	err := r.db.WithContext(ctx).First(&hotel, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &hotel, nil
}

type HotelFilter struct {
	City       string
	MinPrice   int64
	MaxPrice   int64
	StarRating int
}

func applyHotelFilter(db *gorm.DB, f HotelFilter) *gorm.DB {
	q := db
	if f.City != "" {
		q = q.Where("city ILIKE ?", "%"+f.City+"%")
	}
	if f.MinPrice > 0 {
		q = q.Where("price_per_night >= ?", f.MinPrice)
	}
	if f.MaxPrice > 0 {
		q = q.Where("price_per_night <= ?", f.MaxPrice)
	}
	if f.StarRating > 0 {
		q = q.Where("star_rating = ?", f.StarRating)
	}
	return q
}

func (r *HotelRepository) List(ctx context.Context, f HotelFilter, page, limit int) ([]models.Hotel, error) {
	var hotels []models.Hotel
	q := applyHotelFilter(r.db.WithContext(ctx).Model(&models.Hotel{}), f)
	q = q.Order("city ASC, star_rating DESC, id ASC")
	if limit > 0 {
		q = q.Limit(limit).Offset((page - 1) * limit)
	}
	if err := q.Find(&hotels).Error; err != nil {
		return nil, err
	}
	return hotels, nil
}

func (r *HotelRepository) Count(ctx context.Context, f HotelFilter) (int64, error) {
	var total int64
	q := applyHotelFilter(r.db.WithContext(ctx).Model(&models.Hotel{}), f)
	if err := q.Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

func (r *HotelRepository) ListCities(ctx context.Context) ([]string, error) {
	var cities []string
	if err := r.db.WithContext(ctx).
		Model(&models.Hotel{}).
		Distinct("city").
		Where("city <> ''").
		Order("city ASC").
		Pluck("city", &cities).Error; err != nil {
		return nil, err
	}
	return cities, nil
}

func (r *HotelRepository) Create(ctx context.Context, hotel *models.Hotel) error {
	return r.db.WithContext(ctx).Create(hotel).Error
}

func (r *HotelRepository) Update(ctx context.Context, hotel *models.Hotel) error {
	return r.db.WithContext(ctx).Save(hotel).Error
}

func (r *HotelRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.Hotel{}, id).Error
}

func (r *HotelRepository) DeletePermanent(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Unscoped().Delete(&models.Hotel{}, id).Error
}
