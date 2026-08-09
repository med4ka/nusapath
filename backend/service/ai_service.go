package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-playground/validator/v10"

	"smart-tourism/pkg/ai"
)

var (
	validBudgets = map[string]bool{
		"Hemat":    true,
		"Menengah": true,
		"Mewah":    true,
	}
	validStyles = map[string]bool{
		"Budaya & Sejarah":  true,
		"Alam & Petualangan": true,
		"Kuliner & Santai":   true,
	}
)

const SmartTripDailyLimit = 10

var ErrSmartTripRateLimit = fmt.Errorf("Kamu sudah mencapai batas %d pembuatan itinerary hari ini, coba lagi besok", SmartTripDailyLimit)

type ItineraryRequest struct {
	Budget string `json:"budget" validate:"required,budget_enum"`
	Style  string `json:"style" validate:"required,style_enum"`
	Days   int    `json:"days" validate:"required,gt=0,lte=14"`
	Focus  string `json:"focus,omitempty"`
}

type AIService struct {
	validate   *validator.Validate
	rateStore  *sync.Map
}

func NewAIService() *AIService {
	validate := validator.New()
	validate.RegisterValidation("budget_enum", func(fl validator.FieldLevel) bool {
		return validBudgets[fl.Field().String()]
	})
	validate.RegisterValidation("style_enum", func(fl validator.FieldLevel) bool {
		return validStyles[fl.Field().String()]
	})
	return &AIService{
		validate:  validate,
		rateStore: &sync.Map{},
	}
}

func (s *AIService) checkRateLimit(userID uint) error {
	now := time.Now()
	today := now.Format("2006-01-02")
	key := fmt.Sprintf("%d:%s", userID, today)

	val, _ := s.rateStore.LoadOrStore(key, &rateEntry{count: 0, date: today})
	entry := val.(*rateEntry)

	// Reset if entry is from a previous day (edge case: map cleanup)
	if entry.date != today {
		entry.count = 0
		entry.date = today
	}

	if entry.count >= SmartTripDailyLimit {
		return ErrSmartTripRateLimit
	}
	return nil
}

func (s *AIService) incrementRateLimit(userID uint) {
	now := time.Now()
	today := now.Format("2006-01-02")
	key := fmt.Sprintf("%d:%s", userID, today)

	val, _ := s.rateStore.LoadOrStore(key, &rateEntry{count: 0, date: today})
	entry := val.(*rateEntry)
	if entry.date == today {
		entry.count++
	}
}

type rateEntry struct {
	count int
	date  string
}

// GenerateItinerary — validate first (SPEC §6.3), then rate limit,
// then call pkg/ai (paid external API — rate limit protects costs).
// userID = 0 bypasses rate limit (anonymous, but should still be limited).
func (s *AIService) GenerateItinerary(ctx context.Context, userID uint, req ItineraryRequest) (string, error) {
	if err := s.validate.Struct(req); err != nil {
		return "", fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	if userID > 0 {
		if err := s.checkRateLimit(userID); err != nil {
			return "", err
		}
		// Count attempt BEFORE Gemini call (same pattern as Gari chat):
		// failed calls still consume quota to prevent spam retry.
		s.incrementRateLimit(userID)
	}

	result, err := ai.GenerateSmartTrip(req.Budget, req.Style, req.Days, req.Focus)
	if err != nil {
		return "", err
	}

	return result, nil
}
