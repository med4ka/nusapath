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

var (
	ErrPromoNotFound       = errors.New("kode promo tidak ditemukan atau tidak aktif")
	ErrPromoExpired        = errors.New("kode promo sudah kadaluarsa atau belum berlaku")
	ErrPromoMinPurchase    = errors.New("subtotal belum mencapai minimum pembelian untuk promo ini")
	ErrPromoUsageLimit     = errors.New("kuota pemakaian kode promo sudah habis")
	ErrPromoAlreadyUsed    = errors.New("kode promo sudah pernah dipakai oleh akun ini")
	ErrPromoInvalidType    = errors.New("tipe diskon promo tidak valid")
	ErrPromoInvalidValue   = errors.New("nilai diskon tidak valid")
	ErrPromoNoFields       = errors.New("tidak ada field yang dikirim untuk diubah")
)

type ValidatePromoRequest struct {
	Code     string `json:"code" validate:"required,min=1,max=50"`
	Subtotal int64  `json:"subtotal" validate:"gte=0"`
}

type ValidatePromoResult struct {
	Valid          bool   `json:"valid"`
	DiscountAmount int64  `json:"discount_amount"`
	FinalTotal     int64  `json:"final_total"`
	Message        string `json:"message,omitempty"`
}

type CreatePromoRequest struct {
	Code          string    `json:"code" validate:"required,min=2,max=50"`
	DiscountType  string    `json:"discount_type" validate:"required,oneof=percentage fixed"`
	DiscountValue int64     `json:"discount_value" validate:"gte=1"`
	MinPurchase   *int64    `json:"min_purchase,omitempty"`
	MaxDiscount   *int64    `json:"max_discount,omitempty"`
	ValidFrom     time.Time `json:"valid_from" validate:"required"`
	ValidUntil    time.Time `json:"valid_until" validate:"required,gtfield=ValidFrom"`
	UsageLimit    *int      `json:"usage_limit,omitempty" validate:"omitempty,gt=0"`
	PerUserLimit  *bool     `json:"per_user_limit,omitempty"`
	IsActive      *bool     `json:"is_active,omitempty"`
}

type UpdatePromoRequest struct {
	Code          *string    `json:"code,omitempty" validate:"omitempty,min=2,max=50"`
	DiscountType  *string    `json:"discount_type,omitempty" validate:"omitempty,oneof=percentage fixed"`
	DiscountValue *int64     `json:"discount_value,omitempty" validate:"omitempty,gte=1"`
	MinPurchase   *int64     `json:"min_purchase,omitempty"`
	MaxDiscount   *int64     `json:"max_discount,omitempty"`
	ValidFrom     *time.Time `json:"valid_from,omitempty"`
	ValidUntil    *time.Time `json:"valid_until,omitempty"`
	UsageLimit    *int       `json:"usage_limit,omitempty" validate:"omitempty,gt=0"`
	PerUserLimit  *bool      `json:"per_user_limit,omitempty"`
	IsActive      *bool      `json:"is_active,omitempty"`
}

type PromoService struct {
	promos *repository.PromoRepository
	bookings *repository.BookingRepository
	validate *validator.Validate
}

func NewPromoService(promos *repository.PromoRepository, bookings *repository.BookingRepository) *PromoService {
	return &PromoService{
		promos:   promos,
		bookings: bookings,
		validate: validator.New(),
	}
}

func (s *PromoService) validatePromoCode(ctx context.Context, promo *models.PromoCode, subtotal int64, userID uint) error {
	now := time.Now()
	if now.Before(promo.ValidFrom) || now.After(promo.ValidUntil) {
		return ErrPromoExpired
	}
	if !promo.IsActive {
		return ErrPromoNotFound
	}
	if promo.MinPurchase != nil && subtotal < *promo.MinPurchase {
		return ErrPromoMinPurchase
	}
	if promo.UsageLimit != nil && promo.UsageCount >= *promo.UsageLimit {
		return ErrPromoUsageLimit
	}
	if promo.PerUserLimit != nil && *promo.PerUserLimit {
		used, err := s.promos.HasUsageByUser(ctx, promo.ID, userID)
		if err != nil {
			return err
		}
		if used {
			return ErrPromoAlreadyUsed
		}
	}
	return nil
}

func (s *PromoService) calculateDiscount(promo *models.PromoCode, subtotal int64) int64 {
	switch promo.DiscountType {
	case "percentage":
		d := subtotal * promo.DiscountValue / 100
		if promo.MaxDiscount != nil && d > *promo.MaxDiscount {
			return *promo.MaxDiscount
		}
		return d
	case "fixed":
		if promo.DiscountValue > subtotal {
			return subtotal
		}
		return promo.DiscountValue
	default:
		return 0
	}
}

func (s *PromoService) Validate(ctx context.Context, userID uint, req ValidatePromoRequest) (*ValidatePromoResult, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	promo, err := s.promos.FindByCode(ctx, req.Code)
	if err != nil {
		return nil, err
	}
	if promo == nil {
		return &ValidatePromoResult{Valid: false, Message: ErrPromoNotFound.Error()}, nil
	}

	if err := s.validatePromoCode(ctx, promo, req.Subtotal, userID); err != nil {
		msg := err.Error()
		return &ValidatePromoResult{Valid: false, Message: msg}, nil
	}

	discount := s.calculateDiscount(promo, req.Subtotal)
	final := req.Subtotal - discount
	if final < 0 {
		final = 0
	}

	return &ValidatePromoResult{
		Valid:          true,
		DiscountAmount: discount,
		FinalTotal:     final,
	}, nil
}

// ApplyPromo — re-validate + apply promo to transaction ATOMICALLY.
// Called from BookingService when booking is created (within the same DB
// transaction as Create/CreateTransportBooking).
func (s *PromoService) ApplyPromo(ctx context.Context, bookingID uint, userID uint, code string, subtotal int64) error {
	promo, err := s.promos.FindByCode(ctx, code)
	if err != nil {
		return err
	}
	if promo == nil {
		return ErrPromoNotFound
	}

	if err := s.validatePromoCode(ctx, promo, subtotal, userID); err != nil {
		return err
	}

	discount := s.calculateDiscount(promo, subtotal)

	finalAmount := subtotal - discount
	if finalAmount < 0 {
		finalAmount = 0
	}

	if err := s.promos.CreateUsage(ctx, promo.ID, userID, bookingID); err != nil {
		if errors.Is(err, repository.ErrPromoUsageLimitExhausted) {
			return ErrPromoUsageLimit
		}
		if errors.Is(err, repository.ErrPromoAlreadyUsedByUser) {
			return ErrPromoAlreadyUsed
		}
		return err
	}

	if err := s.bookings.UpdatePromoApplied(ctx, bookingID, promo.ID, discount, finalAmount); err != nil {
		return err
	}

	return nil
}

func (s *PromoService) List(ctx context.Context) ([]models.PromoCode, error) {
	return s.promos.ListAll(ctx)
}

func (s *PromoService) Get(ctx context.Context, id uint) (*models.PromoCode, []models.PromoCodeUsage, error) {
	promo, err := s.promos.FindByID(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	if promo == nil {
		return nil, nil, ErrPromoNotFound
	}
	usages, err := s.promos.ListUsageByPromoID(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	return promo, usages, nil
}

func (s *PromoService) Create(ctx context.Context, req CreatePromoRequest) (*models.PromoCode, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	if req.DiscountType == "percentage" && (req.DiscountValue < 1 || req.DiscountValue > 100) {
		return nil, ErrPromoInvalidValue
	}

	perUserLimit := true
	if req.PerUserLimit != nil {
		perUserLimit = *req.PerUserLimit
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	promo := models.PromoCode{
		Code:          req.Code,
		DiscountType:  req.DiscountType,
		DiscountValue: req.DiscountValue,
		MinPurchase:   req.MinPurchase,
		MaxDiscount:   req.MaxDiscount,
		ValidFrom:     req.ValidFrom,
		ValidUntil:    req.ValidUntil,
		UsageLimit:    req.UsageLimit,
		PerUserLimit:  &perUserLimit,
		IsActive:      isActive,
	}
	if err := s.promos.Create(ctx, &promo); err != nil {
		return nil, err
	}
	return &promo, nil
}

func (s *PromoService) Update(ctx context.Context, id uint, req UpdatePromoRequest) (*models.PromoCode, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	promo, err := s.promos.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if promo == nil {
		return nil, ErrPromoNotFound
	}

	changed := false
	if req.Code != nil {
		promo.Code = *req.Code
		changed = true
	}
	if req.DiscountType != nil {
		promo.DiscountType = *req.DiscountType
		changed = true
	}
	if req.DiscountValue != nil {
		promo.DiscountValue = *req.DiscountValue
		changed = true
	}
	if req.MinPurchase != nil {
		promo.MinPurchase = req.MinPurchase
		changed = true
	}
	if req.MaxDiscount != nil {
		promo.MaxDiscount = req.MaxDiscount
		changed = true
	}
	if req.ValidFrom != nil {
		promo.ValidFrom = *req.ValidFrom
		changed = true
	}
	if req.ValidUntil != nil {
		promo.ValidUntil = *req.ValidUntil
		changed = true
	}
	if req.UsageLimit != nil {
		promo.UsageLimit = req.UsageLimit
		changed = true
	}
	if req.PerUserLimit != nil {
		promo.PerUserLimit = req.PerUserLimit
		changed = true
	}
	if req.IsActive != nil {
		promo.IsActive = *req.IsActive
		changed = true
	}
	if !changed {
		return nil, ErrPromoNoFields
	}

	if err := s.promos.Update(ctx, promo); err != nil {
		return nil, err
	}
	return promo, nil
}

func (s *PromoService) Delete(ctx context.Context, id uint) error {
	promo, err := s.promos.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if promo == nil {
		return ErrPromoNotFound
	}

	count, err := s.bookings.CountByPromoID(ctx, id)
	if err != nil {
		return err
	}
	if count > 0 {
		return s.promos.Delete(ctx, id)
	}
	return s.promos.Delete(ctx, id)
}
