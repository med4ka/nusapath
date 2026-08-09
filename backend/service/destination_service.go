package service

import (
	"context"

	"smart-tourism/models"
	"smart-tourism/repository"
)

type ListDestinationsRequest struct {
	Search   string
	Category string
	MinPrice int64
	MaxPrice int64
	// Page > 0 means pagination mode (handler response shape is
	// { data, meta }); Page = 0 means full array response as-is
	// (backward compatible with older frontend that hasn't migrated).
	Page  int
	Limit int
}

type DestinationService struct {
	destinations *repository.DestinationRepository
}

func NewDestinationService(destinations *repository.DestinationRepository) *DestinationService {
	return &DestinationService{destinations: destinations}
}

// userID = 0 for anonymous requests (is_wishlisted not set).
func (s *DestinationService) List(ctx context.Context, req ListDestinationsRequest, userID uint) ([]models.DestinationListItem, int64, error) {
	filter := repository.DestinationFilter{
		Search:   req.Search,
		Category: req.Category,
		MinPrice: req.MinPrice,
		MaxPrice: req.MaxPrice,
	}

	destinations, err := s.destinations.List(ctx, filter, req.Page, req.Limit, userID)
	if err != nil {
		return nil, 0, err
	}

	total, err := s.destinations.Count(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	return destinations, total, nil
}

// Trending — popular destinations for Gari widget (MVP). Limit 6.
// userID = 0 → is_wishlisted not set (anonymous).
func (s *DestinationService) Trending(ctx context.Context, userID uint) ([]models.DestinationListItem, error) {
	return s.destinations.Trending(ctx, 6, userID)
}

// Get returns detail of 1 destination + its images + display rating
// (real review if available, fallback to old field). nil if not found —
// including soft-deleted destinations (default gorm scope, consistent with
// booking price lookup rules in AGENTS.md §4). userID = 0 anonymous →
// is_wishlisted not set in response.
func (s *DestinationService) Get(ctx context.Context, id, userID uint) (*models.DestinationDetail, error) {
	destination, err := s.destinations.FindByID(ctx, id)
	if err != nil || destination == nil {
		return nil, err
	}

	images, err := s.destinations.ListImages(ctx, id)
	if err != nil {
		return nil, err
	}

	rating, wishlisted, err := s.destinations.Meta(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	detail := &models.DestinationDetail{Destination: *destination, Images: images}
	detail.Rating = rating
	if userID > 0 {
		detail.IsWishlisted = &wishlisted
	}
	return detail, nil
}
