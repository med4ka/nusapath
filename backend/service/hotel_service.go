package service

import (
	"context"
	"fmt"

	"github.com/go-playground/validator/v10"

	"smart-tourism/models"
	"smart-tourism/repository"
)

type ListHotelsRequest struct {
	City       string
	MinPrice   int64
	MaxPrice   int64
	StarRating int
	Page       int
	Limit      int
}

type CreateHotelRequest struct {
	Name          string `json:"name" validate:"required,max=150"`
	City          string `json:"city" validate:"required,max=100"`
	PricePerNight int64  `json:"price_per_night" validate:"gt=0"`
	StarRating    int    `json:"star_rating" validate:"gte=1,lte=5"`
	Description   string `json:"description"`
	ImageURL      string `json:"image_url"`
	Amenities     string `json:"amenities"`
}

type UpdateHotelRequest struct {
	Name          *string `json:"name" validate:"omitempty,max=150"`
	City          *string `json:"city" validate:"omitempty,max=100"`
	PricePerNight *int64  `json:"price_per_night" validate:"omitempty,gt=0"`
	StarRating    *int    `json:"star_rating" validate:"omitempty,gte=1,lte=5"`
	Description   *string `json:"description"`
	ImageURL      *string `json:"image_url"`
	Amenities     *string `json:"amenities"`
}

type HotelService struct {
	hotels   *repository.HotelRepository
	bookings *repository.BookingRepository
	validate *validator.Validate
}

func NewHotelService(hotels *repository.HotelRepository, bookings *repository.BookingRepository) *HotelService {
	return &HotelService{
		hotels:   hotels,
		bookings: bookings,
		validate: validator.New(),
	}
}

func (s *HotelService) List(ctx context.Context, req ListHotelsRequest) ([]models.Hotel, int64, error) {
	filter := repository.HotelFilter{
		City:       req.City,
		MinPrice:   req.MinPrice,
		MaxPrice:   req.MaxPrice,
		StarRating: req.StarRating,
	}
	hotels, err := s.hotels.List(ctx, filter, req.Page, req.Limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.hotels.Count(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	return hotels, total, nil
}

func (s *HotelService) Get(ctx context.Context, id uint) (*models.Hotel, error) {
	return s.hotels.FindByID(ctx, id)
}

func (s *HotelService) Cities(ctx context.Context) ([]string, error) {
	return s.hotels.ListCities(ctx)
}

func (s *HotelService) Create(ctx context.Context, req CreateHotelRequest) (*models.Hotel, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}
	hotel := models.Hotel{
		Name:          req.Name,
		City:          req.City,
		PricePerNight: req.PricePerNight,
		StarRating:    req.StarRating,
		Description:   req.Description,
		ImageURL:      req.ImageURL,
		Amenities:     req.Amenities,
	}
	if err := s.hotels.Create(ctx, &hotel); err != nil {
		return nil, err
	}
	return &hotel, nil
}

func (s *HotelService) Update(ctx context.Context, id uint, req UpdateHotelRequest) (*models.Hotel, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	existing, err := s.hotels.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrHotelNotFound
	}

	changed := false
	if req.Name != nil {
		existing.Name = *req.Name
		changed = true
	}
	if req.City != nil {
		existing.City = *req.City
		changed = true
	}
	if req.PricePerNight != nil {
		existing.PricePerNight = *req.PricePerNight
		changed = true
	}
	if req.StarRating != nil {
		existing.StarRating = *req.StarRating
		changed = true
	}
	if req.Description != nil {
		existing.Description = *req.Description
		changed = true
	}
	if req.ImageURL != nil {
		existing.ImageURL = *req.ImageURL
		changed = true
	}
	if req.Amenities != nil {
		existing.Amenities = *req.Amenities
		changed = true
	}
	if !changed {
		return nil, ErrNoFieldsToUpdate
	}

	if err := s.hotels.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *HotelService) Delete(ctx context.Context, id uint) (string, error) {
	existing, err := s.hotels.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if existing == nil {
		return "", ErrHotelNotFound
	}

	bookingCount, err := s.bookings.CountByHotelID(ctx, id)
	if err != nil {
		return "", err
	}

	if bookingCount > 0 {
		if err := s.hotels.Delete(ctx, id); err != nil {
			return "", err
		}
		return "soft", nil
	}
	if err := s.hotels.DeletePermanent(ctx, id); err != nil {
		return "", err
	}
	return "hard", nil
}
