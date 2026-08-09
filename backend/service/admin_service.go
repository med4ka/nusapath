package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-playground/validator/v10"

	"smart-tourism/models"
	"smart-tourism/repository"
)

var ErrImageNotFound = errors.New("foto tidak ditemukan")
var ErrNoFieldsToUpdate = errors.New("tidak ada field yang dikirim untuk diubah")

type CreateDestinationRequest struct {
	Name        string  `json:"name" validate:"required,max=150"`
	Category    string  `json:"category" validate:"required,max=50"`
	Description string  `json:"description" validate:"max=5000"`
	Price       int64   `json:"price" validate:"gt=0"`
	Rating      float64 `json:"rating" validate:"gte=0,lte=5"`
	ImageURL    string  `json:"image_url" validate:"omitempty,url,max=255"`
}

// UpdateDestinationRequest uses pointers so unsent fields
// (nil) do not overwrite old values. Omitempty + pointer = validation skipped
// when nil, executed when a value is present.
type UpdateDestinationRequest struct {
	Name        *string  `json:"name" validate:"omitempty,max=150"`
	Category    *string  `json:"category" validate:"omitempty,max=50"`
	Description *string  `json:"description" validate:"omitempty,max=5000"`
	Price       *int64   `json:"price" validate:"omitempty,gt=0"`
	Rating      *float64 `json:"rating" validate:"omitempty,gte=0,lte=5"`
	ImageURL    *string  `json:"image_url" validate:"omitempty,url,max=255"`
}

type AddImageRequest struct {
	ImageURL  string `json:"image_url" validate:"required,url,max=255"`
	SortOrder int    `json:"sort_order" validate:"gte=0"`
	IsPrimary bool   `json:"is_primary"`
}

type AdminService struct {
	destinations *repository.DestinationRepository
	bookings     *repository.BookingRepository
	validate     *validator.Validate
}

func NewAdminService(destinations *repository.DestinationRepository, bookings *repository.BookingRepository) *AdminService {
	return &AdminService{
		destinations: destinations,
		bookings:     bookings,
		validate:     validator.New(),
	}
}

func (s *AdminService) CreateDestination(ctx context.Context, req CreateDestinationRequest) (*models.Destination, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	destination := models.Destination{
		Name:        req.Name,
		Category:    req.Category,
		Description: req.Description,
		Price:       req.Price,
		Rating:      req.Rating,
		ImageURL:    req.ImageURL,
	}
	if err := s.destinations.Create(ctx, &destination); err != nil {
		return nil, err
	}
	return &destination, nil
}

func (s *AdminService) UpdateDestination(ctx context.Context, id uint, req UpdateDestinationRequest) (*models.Destination, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	existing, err := s.destinations.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrDestinationNotFound
	}

	// Merge sent (non-nil) fields into existing record. PUT here
	// is partial-update — if strict full PUT is needed later,
	// switch to requiring all fields (design decision, see SPEC §2.5).
	changed := false
	if req.Name != nil {
		existing.Name = *req.Name
		changed = true
	}
	if req.Category != nil {
		existing.Category = *req.Category
		changed = true
	}
	if req.Description != nil {
		existing.Description = *req.Description
		changed = true
	}
	if req.Price != nil {
		existing.Price = *req.Price
		changed = true
	}
	if req.Rating != nil {
		existing.Rating = *req.Rating
		changed = true
	}
	if req.ImageURL != nil {
		existing.ImageURL = *req.ImageURL
		changed = true
	}
	if !changed {
		return nil, ErrNoFieldsToUpdate
	}

	if err := s.destinations.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// DeleteDestination returns the deletion mode: "soft" (deleted_at,
// has booking history) or "hard" (row fully removed, 0 bookings) — so UI
// can show what happened to the admin.
func (s *AdminService) DeleteDestination(ctx context.Context, id uint) (string, error) {
	existing, err := s.destinations.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if existing == nil {
		return "", ErrDestinationNotFound
	}

	bookingCount, err := s.bookings.CountByDestinationID(ctx, id)
	if err != nil {
		return "", err
	}

	if bookingCount > 0 {
		if err := s.destinations.Delete(ctx, id); err != nil {
			return "", err
		}
		return "soft", nil
	}
	if err := s.destinations.DeletePermanent(ctx, id); err != nil {
		return "", err
	}
	return "hard", nil
}

func (s *AdminService) AddImage(ctx context.Context, destinationID uint, req AddImageRequest) (*models.DestinationImage, error) {
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

	image := models.DestinationImage{
		DestinationID: destinationID,
		ImageURL:      req.ImageURL,
		SortOrder:     req.SortOrder,
		IsPrimary:     req.IsPrimary,
	}
	if err := s.destinations.CreateImage(ctx, &image); err != nil {
		return nil, err
	}
	return &image, nil
}

func (s *AdminService) RemoveImage(ctx context.Context, destinationID, imageID uint) error {
	image, err := s.destinations.FindImage(ctx, imageID)
	if err != nil {
		return err
	}
	if image == nil {
		return ErrImageNotFound
	}
	if image.DestinationID != destinationID {
		// Image belongs to another destination — do not leak its existence via
		// a different error message; return 404 same as if image does not exist.
		return ErrImageNotFound
	}
	return s.destinations.DeleteImage(ctx, imageID)
}
