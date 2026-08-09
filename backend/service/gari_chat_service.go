package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"smart-tourism/pkg/ai"
	"smart-tourism/repository"
)

// GariDailyLimit — max chats per user per day (WIB). Cost
// control: every attempt (Gemini success/failure) is logged and counted,
// so users cannot spam retries to "reset" their quota.
const GariDailyLimit = 5

// ErrGariRateLimit — user has exhausted today's chat quota.
var ErrGariRateLimit = errors.New("Kamu sudah mencapai batas 5 obrolan dengan Gari hari ini, coba lagi besok")

// GariChatRequest — body of POST /api/gari/chat. Message validated 1-500.
type GariChatRequest struct {
	Message string `json:"message"`
}

// SuggestedDestination — one destination suggested by Gari (only ids that
// actually exist in catalog / DB, not fabricated template).
type SuggestedDestination struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	ImageURL string `json:"image_url"`
	Price    int64  `json:"price"`
}

// GariChatResponse — response of POST /api/gari/chat.
// itinerary nil if user did not request full itinerary (omitempty).
type GariChatResponse struct {
	Reply                 string                 `json:"reply"`
	SuggestedDestinations []SuggestedDestination `json:"suggested_destinations"`
	Itinerary             string                 `json:"itinerary,omitempty"`
}

// GariChatService — Gari chat flow: rate limit → catalog → Gemini.
type GariChatService struct {
	gariLogs     *repository.GariChatRepository
	destinations *repository.DestinationRepository
}

func NewGariChatService(logs *repository.GariChatRepository, destinations *repository.DestinationRepository) *GariChatService {
	return &GariChatService{gariLogs: logs, destinations: destinations}
}

// startOfTodayWIB — 00:00:00 local time Asia/Jakarta (WIB), expressed
// as time.Time (UTC) for gorm created_at query. Base is "today".
func startOfTodayWIB() time.Time {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).UTC()
}

// Chat — full flow of one Gari conversation. Returns ErrGariRateLimit
// (→ handler 429/402) when quota is exhausted.
func (s *GariChatService) Chat(ctx context.Context, userID uint, req GariChatRequest) (*GariChatResponse, error) {
	message := strings.TrimSpace(req.Message)

	// Validate input BEFORE rate limit check / Gemini call — message
	// length is bounded to prevent cost inflation vector.
	if message == "" {
		return nil, fmt.Errorf("%w: pesan tidak boleh kosong", ErrInvalidInput)
	}
	if len([]rune(message)) > 500 {
		return nil, fmt.Errorf("%w: pesan maksimal 500 karakter", ErrInvalidInput)
	}

	// 1) Rate limit per user per day (WIB). Count existing attempts.
	used, err := s.gariLogs.CountSince(ctx, userID, startOfTodayWIB())
	if err != nil {
		return nil, err
	}
	if used >= GariDailyLimit {
		return nil, ErrGariRateLimit
	}

	// Log NEW attempt BEFORE Gemini request — whether Gemini succeeds
	// or fails, today's quota is still consumed.
	if err := s.gariLogs.Create(ctx, userID, message); err != nil {
		return nil, err
	}

	// 2) Build catalog of real destinations from trending (names that actually
	// exist — Gemini must not fabricate). Catalog text is only (id — name);
	// full data (image_url, price) fetched again after chat to find
	// relevant ids. Cache catalog in slice to avoid re-querying.
	trending, err := s.destinations.Trending(ctx, 6, 0)
	if err != nil {
		return nil, err
	}

	var catalogParts []string
	byID := map[uint]SuggestedDestination{}
	for _, d := range trending {
		catalogParts = append(catalogParts, fmt.Sprintf("%d — %s", d.ID, d.Name))
		byID[d.ID] = SuggestedDestination{
			ID:       d.ID,
			Name:     d.Name,
			ImageURL: d.ImageURL,
			Price:    d.Price,
		}
	}
	catalog := strings.Join(catalogParts, "\n")

	result, err := ai.GenerateChat(message, catalog)
	if err != nil {
		return nil, err
	}

	// 3) Suggested destination — only from real catalog (ignore fabricated ids).
	suggested := []SuggestedDestination{}
	for _, id := range result.RecommendedIDs {
		if d, ok := byID[id]; ok {
			suggested = append(suggested, d)
		}
	}

	// 4) If user requests full itinerary, call GenerateSmartTrip (SAME
	// function as /api/smart-trip — itinerary prompt is not duplicated).
	var itinerary string
	if result.WantItinerary {
		budget := result.Budget
		if budget == "" {
			budget = "Menengah"
		}
		style := result.Style
		if style == "" {
			style = "Budaya & Sejarah"
		}
		days := result.Days
		if days < 1 {
			days = 3
		}
		raw, terr := ai.GenerateSmartTrip(budget, style, days, suggestedDestinationName(byID, result.IntendedDestinationID))
		if terr == nil && raw != "" {
			itinerary = raw
		}
	}

	return &GariChatResponse{
		Reply:                 result.Reply,
		SuggestedDestinations: suggested,
		Itinerary:             itinerary,
	}, nil
}

func suggestedDestinationName(byID map[uint]SuggestedDestination, id uint) string {
	if id == 0 {
		return ""
	}
	if d, ok := byID[id]; ok {
		return d.Name
	}
	return ""
}