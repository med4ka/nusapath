package service

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
	"smart-tourism/repository"
)

// WishlistService — POST /api/wishlist/:destinationId (toggle) + GET
// /api/wishlist/me. Both require auth; userID comes from context
// cookie, never from body.
type WishlistService struct {
	wishlists    *repository.WishlistRepository
	destinations *repository.DestinationRepository
}

func NewWishlistService(wishlists *repository.WishlistRepository, destinations *repository.DestinationRepository) *WishlistService {
	return &WishlistService{wishlists: wishlists, destinations: destinations}
}

// Toggle returns (wishlisted, error): true = now in wishlist (just inserted),
// false = just removed from wishlist.
func (s *WishlistService) Toggle(ctx context.Context, userID, destinationID uint) (bool, error) {
	destination, err := s.destinations.FindByID(ctx, destinationID)
	if err != nil {
		return false, err
	}
	if destination == nil {
		return false, ErrDestinationNotFound
	}

	existing, err := s.wishlists.Find(ctx, userID, destinationID)
	if err != nil {
		return false, err
	}
	if existing != nil {
		if err := s.wishlists.DeleteByUserAndDestination(ctx, userID, destinationID); err != nil {
			return false, err
		}
		return false, nil
	}

	if err := s.wishlists.Create(ctx, &models.Wishlist{UserID: userID, DestinationID: destinationID}); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			// Race: two parallel toggle requests → unique index rejects insert;
			// final result remains "wishlisted" (row already exists).
			return true, nil
		}
		return false, err
	}
	return true, nil
}

func (s *WishlistService) ListMe(ctx context.Context, userID uint) ([]models.WishlistItem, error) {
	return s.wishlists.ListByUser(ctx, userID)
}