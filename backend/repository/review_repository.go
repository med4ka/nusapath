package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type ReviewRepository struct {
	db *gorm.DB
}

func NewReviewRepository(db *gorm.DB) *ReviewRepository {
	return &ReviewRepository{db: db}
}

// FindEligibleIssuedTransaction — find 1 transaction belonging to user that is
// eligible for reviewing this destination: status TICKET_ISSUED AND not yet
// reviewed (NOT EXISTS on reviews). Ordered created_at ASC → user reviews
// the oldest booking first. nil if none eligible (user hasn't paid / all
// tickets already reviewed).
func (r *ReviewRepository) FindEligibleIssuedTransaction(ctx context.Context, userID, destinationID uint) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("user_id = ? AND destination_id = ? AND status = ?", userID, destinationID, models.StatusTicketIssued).
		Where("NOT EXISTS (SELECT 1 FROM reviews rv WHERE rv.transaction_id = transactions.id)").
		Order("created_at ASC").
		First(&transaction).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

func (r *ReviewRepository) Create(ctx context.Context, review *models.Review) error {
	return r.db.WithContext(ctx).Create(review).Error
}

// ListByDestination — all reviews for a destination + reviewer name
// (Preload User so UserName can be denormalized without N+1), sorted
// newest first. Reviews of soft-deleted destinations are still shown
// (Preload User only; Review has no DeletedAt).
func (r *ReviewRepository) ListByDestination(ctx context.Context, destinationID uint) ([]models.Review, error) {
	var reviews []models.Review
	err := r.db.WithContext(ctx).
		Where("destination_id = ?", destinationID).
		Preload("User").
		Order("created_at DESC").
		Find(&reviews).Error
	if err != nil {
		return nil, err
	}
	return reviews, nil
}

func (r *ReviewRepository) CountByDestination(ctx context.Context, destinationID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.Review{}).
		Where("destination_id = ?", destinationID).
		Count(&count).Error
	return count, err
}

func (r *ReviewRepository) AverageByDestination(ctx context.Context, destinationID uint) (float64, error) {
	var avg struct {
		Rating float64
	}
	err := r.db.WithContext(ctx).
		Table("reviews").
		Select("ROUND(AVG(rating)::numeric, 1) AS rating").
		Where("destination_id = ?", destinationID).
		Scan(&avg).Error
	return avg.Rating, err
}