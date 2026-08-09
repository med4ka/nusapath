package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/go-playground/validator/v10"

	"smart-tourism/models"
	"smart-tourism/repository"
)

type ListTransportRoutesRequest struct {
	Type       string
	OriginCity string
	DestCity   string
	Date       string
	Page       int
	Limit      int
}

type CreateTransportRouteRequest struct {
	Type           string    `json:"type" validate:"required,oneof=flight train bus"`
	OperatorName   string    `json:"operator_name" validate:"required,max=100"`
	OriginCity     string    `json:"origin_city" validate:"required,max=100"`
	DestCity       string    `json:"dest_city" validate:"required,max=100"`
	DepartureTime  time.Time `json:"departure_time" validate:"required"`
	ArrivalTime    time.Time `json:"arrival_time" validate:"required"`
	Price          int64     `json:"price" validate:"gt=0"`
	SeatClass      string    `json:"seat_class" validate:"max=50"`
	TotalSeats     int       `json:"total_seats" validate:"required,gt=0"`
	AvailableSeats *int      `json:"available_seats" validate:"omitempty,gte=0"`
}

type UpdateTransportRouteRequest struct {
	Type           *string    `json:"type" validate:"omitempty,oneof=flight train bus"`
	OperatorName   *string    `json:"operator_name" validate:"omitempty,max=100"`
	OriginCity     *string    `json:"origin_city" validate:"omitempty,max=100"`
	DestCity       *string    `json:"dest_city" validate:"omitempty,max=100"`
	DepartureTime  *time.Time `json:"departure_time"`
	ArrivalTime    *time.Time `json:"arrival_time"`
	Price          *int64     `json:"price" validate:"omitempty,gt=0"`
	SeatClass      *string    `json:"seat_class" validate:"omitempty,max=50"`
	TotalSeats     *int       `json:"total_seats" validate:"omitempty,gt=0"`
	AvailableSeats *int       `json:"available_seats" validate:"omitempty,gte=0"`
}

func validateArrival(departure, arrival *time.Time, requireBoth bool) error {
	var dep, arr time.Time
	switch {
	case requireBoth:
		dep, arr = *departure, *arrival
	case departure != nil && arrival != nil:
		dep, arr = *departure, *arrival
	default:
		return nil
	}
	if !arr.After(dep) {
		return errors.New("waktu tiba harus setelah waktu berangkat")
	}
	return nil
}

type TransportService struct {
	transports *repository.TransportRouteRepository
	bookings   *repository.BookingRepository
	validate   *validator.Validate
}

func NewTransportService(transports *repository.TransportRouteRepository, bookings *repository.BookingRepository) *TransportService {
	return &TransportService{
		transports: transports,
		bookings:   bookings,
		validate:   validator.New(),
	}
}

// List returns (routes, total). Filter + pagination applied in
// repository; total always calculated WITHOUT page/limit (for meta).
func (s *TransportService) List(ctx context.Context, req ListTransportRoutesRequest) ([]models.TransportRoute, int64, error) {
	filter := repository.TransportRouteFilter{
		Type:       req.Type,
		OriginCity: req.OriginCity,
		DestCity:   req.DestCity,
		Date:       req.Date,
	}
	routes, err := s.transports.List(ctx, filter, req.Page, req.Limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.transports.Count(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	return routes, total, nil
}

// Get returns detail of 1 route; nil if not found / soft-deleted.
func (s *TransportService) Get(ctx context.Context, id uint) (*models.TransportRoute, error) {
	return s.transports.FindByID(ctx, id)
}

func (s *TransportService) Cities(ctx context.Context) ([]string, error) {
	return s.transports.ListCities(ctx)
}

func (s *TransportService) Create(ctx context.Context, req CreateTransportRouteRequest) (*models.TransportRoute, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}
	if err := validateArrival(&req.DepartureTime, &req.ArrivalTime, true); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, err)
	}

	available := req.TotalSeats
	if req.AvailableSeats != nil {
		available = *req.AvailableSeats
	}
	route := models.TransportRoute{
		Type:           req.Type,
		OperatorName:   req.OperatorName,
		OriginCity:     req.OriginCity,
		DestCity:       req.DestCity,
		DepartureTime:  req.DepartureTime,
		ArrivalTime:    req.ArrivalTime,
		Price:          req.Price,
		SeatClass:      req.SeatClass,
		TotalSeats:     req.TotalSeats,
		AvailableSeats: available,
	}
	if err := s.transports.Create(ctx, &route); err != nil {
		return nil, err
	}
	return &route, nil
}

// Update is PARTIAL — unsent fields (nil) do not overwrite old values.
// Body {} → 400 (same pattern as UpdateDestination).
func (s *TransportService) Update(ctx context.Context, id uint, req UpdateTransportRouteRequest) (*models.TransportRoute, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}
	if req.DepartureTime != nil || req.ArrivalTime != nil {
		if err := validateArrival(req.DepartureTime, req.ArrivalTime, false); err != nil {
			return nil, fmt.Errorf("%w: %s", ErrInvalidInput, err)
		}
	}

	existing, err := s.transports.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, ErrTransportRouteNotFound
	}

	changed := false
	if req.Type != nil {
		existing.Type = *req.Type
		changed = true
	}
	if req.OperatorName != nil {
		existing.OperatorName = *req.OperatorName
		changed = true
	}
	if req.OriginCity != nil {
		existing.OriginCity = *req.OriginCity
		changed = true
	}
	if req.DestCity != nil {
		existing.DestCity = *req.DestCity
		changed = true
	}
	if req.DepartureTime != nil {
		existing.DepartureTime = *req.DepartureTime
		changed = true
	}
	if req.ArrivalTime != nil {
		existing.ArrivalTime = *req.ArrivalTime
		changed = true
	}
	if req.Price != nil {
		existing.Price = *req.Price
		changed = true
	}
	if req.SeatClass != nil {
		existing.SeatClass = *req.SeatClass
		changed = true
	}
	if req.TotalSeats != nil {
		existing.TotalSeats = *req.TotalSeats
		changed = true
	}
	if req.AvailableSeats != nil {
		existing.AvailableSeats = *req.AvailableSeats
		changed = true
	}
	if !changed {
		return nil, ErrNoFieldsToUpdate
	}

	if err := s.transports.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// Delete returns mode: "soft" (deleted_at — has booking history) or
// "hard" (row removed — 0 bookings). Same pattern as destinations.
func (s *TransportService) Delete(ctx context.Context, id uint) (string, error) {
	existing, err := s.transports.FindByID(ctx, id)
	if err != nil {
		return "", err
	}
	if existing == nil {
		return "", ErrTransportRouteNotFound
	}

	bookingCount, err := s.bookings.CountByTransportRouteID(ctx, id)
	if err != nil {
		return "", err
	}

	if bookingCount > 0 {
		if err := s.transports.Delete(ctx, id); err != nil {
			return "", err
		}
		return "soft", nil
	}
	if err := s.transports.DeletePermanent(ctx, id); err != nil {
		return "", err
	}
	return "hard", nil
}