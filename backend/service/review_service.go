package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"smart-tourism/models"
	"smart-tourism/repository"
)

var (
	// ErrNoEligibleBooking — user has no TICKET_ISSUED booking
	// that has not been reviewed for this destination (message returned by handler).
	ErrNoEligibleBooking = errors.New("Anda harus menyelesaikan booking untuk destinasi ini sebelum bisa memberi ulasan")
	ErrAlreadyReviewed   = errors.New("Transaksi ini sudah pernah diulas")
)

type CreateReviewRequest struct {
	Rating  int    `json:"rating" validate:"required,min=1,max=5"`
	Comment string `json:"comment" validate:"omitempty,max=2000"`
}

// ReviewService — POST /api/destinations/:id/reviews (auth required) + GET
// /api/destinations/:id/reviews (public). Review eligibility validation in
// service layer with clear error messages; unique constraint on
// transaction_id is kept as last line of defense in DB.
type ReviewService struct {
	reviews      *repository.ReviewRepository
	destinations *repository.DestinationRepository
	validate     *validator.Validate
}

func NewReviewService(reviews *repository.ReviewRepository, destinations *repository.DestinationRepository) *ReviewService {
	return &ReviewService{
		reviews:      reviews,
		destinations: destinations,
		validate:     validator.New(),
	}
}

// Requirement: user has a TICKET_ISSUED transaction for this destination
// that has never been reviewed. transaction_id from the oldest booking;
// unique constraint on transaction_id prevents double review even in parallel.
func (s *ReviewService) Create(ctx context.Context, userID, destinationID uint, req CreateReviewRequest) (*models.Review, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	destination, err := s.destinations.FindByID(ctx, destinationID)
	if err != nil {
		return nil, err
	}
	if destination == nil {
		return nil, ErrDestinationNotFound
	}

	transaction, err := s.reviews.FindEligibleIssuedTransaction(ctx, userID, destinationID)
	if err != nil {
		return nil, err
	}
	if transaction == nil {
		return nil, ErrNoEligibleBooking
	}

	review := models.Review{
		UserID:        userID,
		DestinationID: destinationID,
		TransactionID: transaction.ID,
		Rating:        req.Rating,
		Comment:       req.Comment,
	}
	if err := s.reviews.Create(ctx, &review); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			// Parallel race / same transaction already reviewed this second.
			return nil, ErrAlreadyReviewed
		}
		return nil, err
	}
	return &review, nil
}

// AverageRating is nil if no reviews yet; rating_count = number of reviews.
func (s *ReviewService) List(ctx context.Context, destinationID uint) (*models.ReviewList, error) {
	destination, err := s.destinations.FindByID(ctx, destinationID)
	if err != nil {
		return nil, err
	}
	if destination == nil {
		return nil, ErrDestinationNotFound
	}

	reviews, err := s.reviews.ListByDestination(ctx, destinationID)
	if err != nil {
		return nil, err
	}

	out := &models.ReviewList{
		DestinationID: destinationID,
		ReviewCount:   int64(len(reviews)),
		Reviews:       make([]models.ReviewDetail, 0, len(reviews)),
	}
	if len(reviews) > 0 {
		avg, err := s.reviews.AverageByDestination(ctx, destinationID)
		if err != nil {
			return nil, err
		}
		out.AverageRating = &avg
	}
	for i := range reviews {
		detail := models.ReviewDetail{Review: reviews[i]}
		if reviews[i].User.ID != 0 {
			detail.UserName = reviews[i].User.Name
		}
		out.Reviews = append(out.Reviews, detail)
	}
	return out, nil
}