package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"

	"smart-tourism/models"
	"smart-tourism/pkg/ipfs"
	"smart-tourism/pkg/payment"
	"smart-tourism/repository"
)

var (
	ErrDestinationNotFound    = errors.New("destinasi tidak ditemukan")
	ErrTransportRouteNotFound = errors.New("rute transportasi tidak ditemukan")
	ErrHotelNotFound          = errors.New("hotel tidak ditemukan")
	ErrTransportSeatsUnavailable = errors.New("kursi transportasi tidak mencukupi")
	ErrIdempotencyConflict    = errors.New("idempotency key sudah dipakai user lain")
	ErrBookingNotFound        = errors.New("booking tidak ditemukan")
	ErrBookingNotOwned        = errors.New("booking bukan milik user ini")
	ErrBookingFailed          = errors.New("booking berstatus FAILED — tidak bisa diproses ulang")
	ErrBookingNotCancellable  = errors.New("booking tidak bisa dibatalkan — hanya booking PENDING_PAYMENT yang bisa dibatalkan")
	ErrBookingTicketIssued    = errors.New("tiket yang sudah terbit tidak bisa dibatalkan")
	ErrTicketNotFound         = errors.New("tiket tidak ditemukan atau tidak valid")
)

type BookingRequest struct {
	// Generalised for transport (Sesi 36) & hotel (Sesi hotel): booking
	// must fill EXACTLY ONE of DestinationID, TransportRouteID, or HotelID.
	DestinationID    *uint `json:"destination_id"`
	TransportRouteID *uint `json:"transport_route_id"`
	HotelID          *uint `json:"hotel_id"`
	// CheckInDate / CheckOutDate — hotel booking dates (required when HotelID set).
	CheckInDate  string `json:"check_in_date,omitempty"`
	CheckOutDate string `json:"check_out_date,omitempty"`
	// IdempotencyKey unique per request (UUID v4 generated client-side).
	IdempotencyKey string `json:"idempotency_key" validate:"required,min=8,max=64"`
	// Quantity — pointer so we can distinguish "not sent" (nil → 1)
	// vs "sent as 0/negative" (must be rejected). Only used as MULTIPLIER:
	//   - destination: unit price from Destination.Price (validated 1–10)
	//   - transport: seat COUNT, unit price from TransportRoute.Price
	//     (upper bound = available_seats, checked ATOMICALLY in repository)
	// amount_paid calculated server-side, never from client.
	Quantity *int `json:"quantity" validate:"omitempty,gte=1"`
	// PromoCode — optional, promo code to use. Validation &
	// discount application done ATOMICALLY in service within the same DB
	// transaction as booking creation, not trusting the pre-validate result.
	PromoCode string `json:"promo_code,omitempty"`
}

// BookingService depends on payment.Provider interface, NOT directly on
// SimulatedProvider — main.go determines which provider to inject (SPEC.md §5).
// Upgrading to a real gateway does not touch the service.
type BookingService struct {
	bookings      *repository.BookingRepository
	destinations  *repository.DestinationRepository
	transports    *repository.TransportRouteRepository
	hotels        *repository.HotelRepository
	promos        *repository.PromoRepository
	notifications *NotificationService
	provider      payment.Provider
	validate      *validator.Validate
}

func NewBookingService(bookings *repository.BookingRepository, destinations *repository.DestinationRepository, transports *repository.TransportRouteRepository, hotels *repository.HotelRepository, promos *repository.PromoRepository, notifications *NotificationService, provider payment.Provider) *BookingService {
	return &BookingService{
		bookings:      bookings,
		destinations:  destinations,
		transports:    transports,
		hotels:        hotels,
		promos:        promos,
		notifications: notifications,
		provider:      provider,
		validate:      validator.New(),
	}
}

// CreateBooking returns (transaction, created, promoMessage).
// promoMessage is filled when a promo code is given but fails to apply,
// so frontend can display a warning to the user.
func (s *BookingService) CreateBooking(ctx context.Context, userID uint, req BookingRequest) (models.Transaction, bool, string, error) {
	if err := s.validate.Struct(req); err != nil {
		return models.Transaction{}, false, "", fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	setCount := 0
	if req.DestinationID != nil {
		setCount++
	}
	if req.TransportRouteID != nil {
		setCount++
	}
	if req.HotelID != nil {
		setCount++
	}
	if setCount != 1 {
		return models.Transaction{}, false, "", fmt.Errorf("%w: booking harus mengisi persis satu dari destination_id, transport_route_id, atau hotel_id", ErrInvalidInput)
	}

	existing, err := s.bookings.FindByIdempotencyKey(ctx, req.IdempotencyKey)
	if err != nil {
		return models.Transaction{}, false, "", err
	}
	if existing != nil {
		// Key is globally unique; belongs to another user = attempt to use someone else's key
		if existing.UserID != userID {
			return models.Transaction{}, false, "", ErrIdempotencyConflict
		}
		return *existing, false, "", nil
	}

	// Quantity defaults to 1 if not sent. AmountPaid is ALWAYS calculated
	// here: unit price from source of truth (Destination/TransportRoute
	// .Price), quantity from client is just a multiplier — no path that
	// accepts amount_paid from client (AGENTS.md §2).
	quantity := 1
	if req.Quantity != nil {
		quantity = *req.Quantity
	}

	var txn models.Transaction
	var created bool

	if req.TransportRouteID != nil {
		txn, created, err = s.createTransportBooking(ctx, userID, req, quantity)
	} else if req.HotelID != nil {
		txn, created, err = s.createHotelBooking(ctx, userID, req)
	} else {
		txn, created, err = s.createDestinationBooking(ctx, userID, req, quantity)
	}
	if err != nil || !created {
		return txn, created, "", err
	}

	// Apply promo code IF present — done AFTER booking is created.
	// If it fails, booking remains at full price (PENDING_PAYMENT),
	// promoMessage contains failure reason to display to user.
	var promoMessage string
	if req.PromoCode != "" {
		if applyErr := s.applyPromoToBooking(ctx, userID, txn, req); applyErr != nil {
			promoMessage = applyErr.Error()
		} else {
			// Reload transaction to get updated amount_paid
			updated, readErr := s.bookings.FindByID(ctx, txn.ID)
			if readErr == nil && updated != nil {
				txn = *updated
			}
		}
	}

	// Notification: booking created successfully
	bookingType := "destinasi"
	if req.TransportRouteID != nil {
		bookingType = "transportasi"
	} else if req.HotelID != nil {
		bookingType = "hotel"
	}
	s.notifications.NotifyBookingCreated(ctx, userID, txn.ID, bookingType)

	return txn, true, promoMessage, nil
}

func (s *BookingService) applyPromoToBooking(ctx context.Context, userID uint, txn models.Transaction, req BookingRequest) error {
	switch {
	case txn.TransportRouteID != nil:
		route, err := s.transports.FindByID(ctx, *txn.TransportRouteID)
		if err != nil || route == nil {
			return ErrTransportRouteNotFound
		}
		subtotal := route.Price * int64(txn.Quantity)
		return s.applyPromo(ctx, txn.ID, userID, req.PromoCode, subtotal)
	case txn.HotelID != nil:
		hotel, err := s.hotels.FindByID(ctx, *txn.HotelID)
		if err != nil || hotel == nil {
			return ErrHotelNotFound
		}
		subtotal := hotel.PricePerNight * int64(txn.Quantity)
		return s.applyPromo(ctx, txn.ID, userID, req.PromoCode, subtotal)
	default:
		dest, err := s.destinations.FindByID(ctx, *txn.DestinationID)
		if err != nil || dest == nil {
			return ErrDestinationNotFound
		}
		subtotal := dest.Price * int64(txn.Quantity)
		return s.applyPromo(ctx, txn.ID, userID, req.PromoCode, subtotal)
	}
}

func (s *BookingService) applyPromo(ctx context.Context, bookingID, userID uint, code string, subtotal int64) error {
	promo, err := s.promos.FindByCode(ctx, code)
	if err != nil {
		return err
	}
	if promo == nil {
		return ErrPromoNotFound
	}

	// Validate promo (expired, min purchase, usage limit, per-user limit)
	now := time.Now()
	if now.Before(promo.ValidFrom) || now.After(promo.ValidUntil) || !promo.IsActive {
		return ErrPromoExpired
	}
	if promo.MinPurchase != nil && subtotal < *promo.MinPurchase {
		return ErrPromoMinPurchase
	}

	// Atomic: check & increment usage_count + insert usage row
	if err := s.promos.CreateUsage(ctx, promo.ID, userID, bookingID); err != nil {
		return err
	}

	// Calculate discount
	discount := s.calculateDiscountAmount(promo, subtotal)
	finalAmount := subtotal - discount
	if finalAmount < 0 {
		finalAmount = 0
	}

	s.notifications.NotifyPromoUsed(ctx, userID, bookingID, code, discount)

	return s.bookings.UpdatePromoApplied(ctx, bookingID, promo.ID, discount, finalAmount)
}

func (s *BookingService) calculateDiscountAmount(promo *models.PromoCode, subtotal int64) int64 {
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

// createDestinationBooking — old flow (Batch 2): quantity 1–10, amount
// calculated from Destination.Price.
func (s *BookingService) createDestinationBooking(ctx context.Context, userID uint, req BookingRequest, quantity int) (models.Transaction, bool, error) {
	if quantity > 10 {
		return models.Transaction{}, false, fmt.Errorf("%w: quantity destinasi maksimal 10", ErrInvalidInput)
	}

	destination, err := s.destinations.FindByID(ctx, *req.DestinationID)
	if err != nil {
		return models.Transaction{}, false, err
	}
	if destination == nil {
		return models.Transaction{}, false, ErrDestinationNotFound
	}

	transaction := models.Transaction{
		UserID:         userID,
		DestinationID:  &destination.ID,
		Quantity:       int64(quantity),
		AmountPaid:     destination.Price * int64(quantity),
		Status:         models.StatusPendingPayment,
		IdempotencyKey: req.IdempotencyKey,
		BookingDate:    time.Now(),
	}
	if err := s.bookings.Create(ctx, &transaction); err != nil {
		return s.resolveCreateDuplicate(ctx, userID, req.IdempotencyKey, err)
	}
	return transaction, true, nil
}

// createTransportBooking — transport flow (Sesi 36): seats deducted ATOMICALLY
// within a single DB transaction together with transaction insert (stock check
// WHERE available_seats >= quantity evaluated in the same UPDATE
// statement). amount = TransportRoute.Price × quantity, calculated server-side.
// createHotelBooking — hotel flow: amount = price_per_night × nights,
// quantity = number of nights. Check-in/out dates are stored for reference.
func (s *BookingService) createHotelBooking(ctx context.Context, userID uint, req BookingRequest) (models.Transaction, bool, error) {
	hotel, err := s.hotels.FindByID(ctx, *req.HotelID)
	if err != nil {
		return models.Transaction{}, false, err
	}
	if hotel == nil {
		return models.Transaction{}, false, ErrHotelNotFound
	}

	checkIn, err := time.Parse("2006-01-02", req.CheckInDate)
	if err != nil {
		return models.Transaction{}, false, fmt.Errorf("%w: format check_in_date tidak valid (YYYY-MM-DD)", ErrInvalidInput)
	}
	checkOut, err := time.Parse("2006-01-02", req.CheckOutDate)
	if err != nil {
		return models.Transaction{}, false, fmt.Errorf("%w: format check_out_date tidak valid (YYYY-MM-DD)", ErrInvalidInput)
	}
	if !checkOut.After(checkIn) {
		return models.Transaction{}, false, fmt.Errorf("%w: check_out harus setelah check_in", ErrInvalidInput)
	}

	nights := int(checkOut.Sub(checkIn).Hours() / 24)
	if nights < 1 {
		return models.Transaction{}, false, fmt.Errorf("%w: minimal 1 malam", ErrInvalidInput)
	}

	transaction := models.Transaction{
		UserID:       userID,
		HotelID:      &hotel.ID,
		CheckInDate:  &checkIn,
		CheckOutDate: &checkOut,
		Quantity:     int64(nights),
		AmountPaid:   hotel.PricePerNight * int64(nights),
		Status:       models.StatusPendingPayment,
		IdempotencyKey: req.IdempotencyKey,
		BookingDate:  time.Now(),
	}
	if err := s.bookings.CreateHotelBooking(ctx, &transaction); err != nil {
		return s.resolveCreateDuplicate(ctx, userID, req.IdempotencyKey, err)
	}
	return transaction, true, nil
}

func (s *BookingService) createTransportBooking(ctx context.Context, userID uint, req BookingRequest, quantity int) (models.Transaction, bool, error) {
	route, err := s.transports.FindByID(ctx, *req.TransportRouteID)
	if err != nil {
		return models.Transaction{}, false, err
	}
	if route == nil {
		return models.Transaction{}, false, ErrTransportRouteNotFound
	}

	transaction := models.Transaction{
		UserID:           userID,
		TransportRouteID: &route.ID,
		Quantity:         int64(quantity),
		AmountPaid:       route.Price * int64(quantity),
		Status:           models.StatusPendingPayment,
		IdempotencyKey:   req.IdempotencyKey,
		BookingDate:      time.Now(),
	}
	if err := s.bookings.CreateTransportBooking(ctx, &transaction, quantity); err != nil {
		if errors.Is(err, repository.ErrInsufficientSeats) {
			return models.Transaction{}, false, ErrTransportSeatsUnavailable
		}
		return s.resolveCreateDuplicate(ctx, userID, req.IdempotencyKey, err)
	}
	return transaction, true, nil
}

// resolveCreateDuplicate — idempotency race (same key arriving in parallel): unique
// index rejects insert, fetch the already-created transaction. For
// transport booking, seats have already been deducted by the winning request (and
// the loser is automatically rolled back together with its insert).
func (s *BookingService) resolveCreateDuplicate(ctx context.Context, userID uint, idempotencyKey string, err error) (models.Transaction, bool, error) {
	if !errors.Is(err, gorm.ErrDuplicatedKey) {
		return models.Transaction{}, false, err
	}
	dup, findErr := s.bookings.FindByIdempotencyKey(ctx, idempotencyKey)
	if findErr != nil {
		return models.Transaction{}, false, findErr
	}
	if dup != nil {
		if dup.UserID != userID {
			return models.Transaction{}, false, ErrIdempotencyConflict
		}
		return *dup, false, nil
	}
	return models.Transaction{}, false, err
}

// ConfirmPayment — POST /api/booking/:id/confirm-payment (Phase 3).
// Sequential validation:
//  1. Booking exists (404) and belongs to logged-in user — user_id from context,
//     NO input from body (endpoint accepts no body at all).
//  2. Current status: PENDING_PAYMENT → proceed to charge. PAID/TICKET_ISSUED →
//     idempotent, return as-is (never charge again).
//     FAILED → reject with clear error.
//
// Success flow: Provider.Charge → PAID (atomic update WHERE status still
// PENDING, anti-double-charge for parallel requests) → build ticket
// payload (DIFFERENT format for destination vs transport, see buildTicketPayload)
// → pin to IPFS (SKIP + warning if PINATA_JWT is not set — dev mode;
// ticket still issued with local hash) → TICKET_ISSUED + ticket_hash.
// Old decision (AGENTS.md §4): IPFS pin happens HERE, NOT when
// booking is created — no anchored tickets for unpaid bookings.
func (s *BookingService) ConfirmPayment(ctx context.Context, userID, bookingID uint) (models.Transaction, error) {
	transaction, err := s.bookings.FindByID(ctx, bookingID)
	if err != nil {
		return models.Transaction{}, err
	}
	if transaction == nil {
		return models.Transaction{}, ErrBookingNotFound
	}
	if transaction.UserID != userID {
		return models.Transaction{}, ErrBookingNotOwned
	}

	switch transaction.Status {
	case models.StatusPaid, models.StatusTicketIssued:
		// Idempotent — already processed, must not charge again.
		return *transaction, nil
	case models.StatusFailed:
		return models.Transaction{}, ErrBookingFailed
	}

	// Charge via provider (only for those still PENDING_PAYMENT).
	if _, err := s.provider.Charge(ctx, transaction.ID, transaction.AmountPaid); err != nil {
		log.Printf("booking: charge gagal untuk booking %d: %v", transaction.ID, err)
		if _, markErr := s.bookings.UpdateStatusWherePending(ctx, transaction.ID, models.StatusFailed); markErr != nil {
			log.Printf("booking: gagal menandai FAILED booking %d: %v", transaction.ID, markErr)
		}
		return models.Transaction{}, ErrBookingFailed
	}

	// Atomic PENDING → PAID. RowsAffected 0 = already processed by another request.
	ok, err := s.bookings.UpdateStatusWherePending(ctx, transaction.ID, models.StatusPaid)
	if err != nil {
		return models.Transaction{}, err
	}
	if !ok {
		// Race: re-read latest state and return idempotently.
		return s.readTransaction(ctx, transaction.ID)
	}

	// Load route data for transport ticket payload (Unscoped — routes that
	// are soft-deleted after booking must still appear in ticket archive).
	var route *models.TransportRoute
	if transaction.TransportRouteID != nil {
		route, err = s.transports.FindByIDUnscoped(ctx, *transaction.TransportRouteID)
		if err != nil {
			return models.Transaction{}, err
		}
	}

	// Load hotel data for hotel ticket payload (Unscoped — hotels that
	// are soft-deleted after booking must still appear in ticket archive).
	var hotel *models.Hotel
	if transaction.HotelID != nil {
		hotel, err = s.hotels.FindByID(ctx, *transaction.HotelID)
		if err != nil {
			return models.Transaction{}, err
		}
	}

	payload, err := buildTicketPayload(transaction, route, hotel)
	if err != nil {
		return models.Transaction{}, err
	}
	hash := sha256.Sum256([]byte(payload))
	ticketHash := hex.EncodeToString(hash[:])

	if _, pinErr := ipfs.PinToIPFS(payload); pinErr != nil {
		// PINATA_JWT not set in dev env → pin is skipped with warning.
		// Local hash still serves as payload integrity proof; real upgrade
		// only requires filling .env (SPEC §6).
		log.Printf("ipfs: pin dilewati untuk booking %d (%v)", transaction.ID, pinErr)
	}

	transaction.TicketPayload = payload
	transaction.TicketHash = ticketHash
	transaction.Status = models.StatusTicketIssued
	if err := s.bookings.Update(ctx, transaction); err != nil {
		return models.Transaction{}, err
	}

	// Determine booking type for notification
	notifType := "destinasi"
	if transaction.TransportRouteID != nil {
		notifType = "transportasi"
	} else if transaction.HotelID != nil {
		notifType = "hotel"
	}
	s.notifications.NotifyPaymentSuccess(ctx, transaction.UserID, transaction.ID, notifType)
	return *transaction, nil
}

func (s *BookingService) readTransaction(ctx context.Context, bookingID uint) (models.Transaction, error) {
	transaction, err := s.bookings.FindByID(ctx, bookingID)
	if err != nil {
		return models.Transaction{}, err
	}
	if transaction == nil {
		return models.Transaction{}, ErrBookingNotFound
	}
	return *transaction, nil
}

// CancelBooking — POST /api/booking/:id/cancel.
// Only allowed when status is PENDING_PAYMENT. For transport: restores
// available_seats atomically. For promo with per_user_limit: restores
// usage slot. All in one DB transaction.
func (s *BookingService) CancelBooking(ctx context.Context, userID, bookingID uint) (models.Transaction, error) {
	transaction, err := s.bookings.FindByID(ctx, bookingID)
	if err != nil {
		return models.Transaction{}, err
	}
	if transaction == nil {
		return models.Transaction{}, ErrBookingNotFound
	}
	if transaction.UserID != userID {
		return models.Transaction{}, ErrBookingNotOwned
	}
	switch transaction.Status {
	case models.StatusPaid, models.StatusTicketIssued:
		return models.Transaction{}, ErrBookingTicketIssued
	case models.StatusFailed:
		return models.Transaction{}, ErrBookingFailed
	case models.StatusCancelled:
		return models.Transaction{}, ErrBookingNotCancellable
	}

	ok, err := s.bookings.CancelBooking(ctx, bookingID, transaction.TransportRouteID, transaction.Quantity, transaction.PromoCodeID)
	if err != nil {
		if err == repository.ErrAlreadyCancelled {
			return models.Transaction{}, ErrBookingNotCancellable
		}
		return models.Transaction{}, err
	}
	if !ok {
		return models.Transaction{}, ErrBookingNotCancellable
	}

	// Re-read to return updated status.
	return s.readTransaction(ctx, bookingID)
}

func (s *BookingService) VerifyTicket(ctx context.Context, hash string) (*models.TicketVerifyResponse, error) {
	txn, err := s.bookings.FindByTicketHash(ctx, hash)
	if err != nil {
		return nil, err
	}
	if txn == nil {
		return nil, ErrTicketNotFound
	}

	var itemName string
	var itemType string
	if txn.DestinationID != nil && txn.Destination.ID != 0 {
		itemType = "destination"
		itemName = txn.Destination.Name
	} else if txn.TransportRouteID != nil && txn.TransportRoute.ID != 0 {
		itemType = "transport"
		itemName = txn.TransportRoute.OriginCity + " → " + txn.TransportRoute.DestCity
	} else if txn.HotelID != nil && txn.Hotel.ID != 0 {
		itemType = "hotel"
		itemName = txn.Hotel.Name
	}

	// Only expose first character of user's name (initial) to avoid PII leak.
	userInitial := ""
	if len(txn.User.Name) > 0 {
		userInitial = string([]rune(txn.User.Name)[0])
	}

	return &models.TicketVerifyResponse{
		Valid:       true,
		ItemType:    itemType,
		ItemName:    itemName,
		AmountPaid:  txn.AmountPaid,
		BookingDate: txn.BookingDate,
		TicketHash:  txn.TicketHash,
		UserInitial: userInitial,
	}, nil
}

// buildTicketPayload — ticket payload, honestly named (SPEC §6): no
// encryption yet, so this field is not ciphertext. Pinned to IPFS on
// confirm-payment success. CONDITIONAL FORMAT:
//   - route != nil → TRANSPORT ticket
//   - hotel != nil → HOTEL ticket
//   - otherwise   → DESTINATION ticket
func buildTicketPayload(transaction *models.Transaction, route *models.TransportRoute, hotel *models.Hotel) (string, error) {
	if route != nil {
		return buildTransportTicketPayload(transaction, route)
	}
	if hotel != nil {
		return buildHotelTicketPayload(transaction, hotel)
	}
	return buildDestinationTicketPayload(transaction)
}

func buildDestinationTicketPayload(transaction *models.Transaction) (string, error) {
	destinationID := uint(0)
	if transaction.DestinationID != nil {
		destinationID = *transaction.DestinationID
	}
	payload := map[string]interface{}{
		"type":            "destination",
		"booking_id":      transaction.ID,
		"destination_id":  destinationID,
		"quantity":        transaction.Quantity,
		"amount_paid":     transaction.AmountPaid,
		"booking_date":    transaction.BookingDate.Format(time.RFC3339),
		"idempotency_key": transaction.IdempotencyKey,
		"ticket_issued_at": time.Now().Format(time.RFC3339),
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func buildTransportTicketPayload(transaction *models.Transaction, route *models.TransportRoute) (string, error) {
	routeID := uint(0)
	if transaction.TransportRouteID != nil {
		routeID = *transaction.TransportRouteID
	}
	payload := map[string]interface{}{
		"type":            "transport",
		"booking_id":      transaction.ID,
		"transport_route_id": routeID,
		"transport_type":  route.Type,
		"operator_name":   route.OperatorName,
		"origin_city":     route.OriginCity,
		"dest_city":       route.DestCity,
		"departure_time":  route.DepartureTime.Format(time.RFC3339),
		"arrival_time":    route.ArrivalTime.Format(time.RFC3339),
		"seat_class":      route.SeatClass,
		"seats":           transaction.Quantity,
		"amount_paid":     transaction.AmountPaid,
		"booking_date":    transaction.BookingDate.Format(time.RFC3339),
		"idempotency_key": transaction.IdempotencyKey,
		"ticket_issued_at": time.Now().Format(time.RFC3339),
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func buildHotelTicketPayload(transaction *models.Transaction, hotel *models.Hotel) (string, error) {
	hotelID := uint(0)
	if transaction.HotelID != nil {
		hotelID = *transaction.HotelID
	}
	checkIn := ""
	checkOut := ""
	if transaction.CheckInDate != nil {
		checkIn = transaction.CheckInDate.Format("2006-01-02")
	}
	if transaction.CheckOutDate != nil {
		checkOut = transaction.CheckOutDate.Format("2006-01-02")
	}
	payload := map[string]interface{}{
		"type":            "hotel",
		"booking_id":      transaction.ID,
		"hotel_id":        hotelID,
		"hotel_name":      hotel.Name,
		"hotel_city":      hotel.City,
		"star_rating":     hotel.StarRating,
		"check_in_date":   checkIn,
		"check_out_date":  checkOut,
		"nights":          transaction.Quantity,
		"amount_paid":     transaction.AmountPaid,
		"booking_date":    transaction.BookingDate.Format(time.RFC3339),
		"idempotency_key": transaction.IdempotencyKey,
		"ticket_issued_at": time.Now().Format(time.RFC3339),
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// MyBookings — logged-in user's history, includes destination details
// OR transport route details (BookingHistoryItem with `type` field) for
// the transaction history page — frontend uses `type` to render different
// cards.
func (s *BookingService) MyBookings(ctx context.Context, userID uint) ([]models.BookingHistoryItem, error) {
	transactions, err := s.bookings.FindByUserIDWithDestination(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]models.BookingHistoryItem, 0, len(transactions))
	for i := range transactions {
		t := &transactions[i]
		item := models.BookingHistoryItem{
			ID:             t.ID,
			UserID:         t.UserID,
			DestinationID:  t.DestinationID,
			TransportRouteID: t.TransportRouteID,
			HotelID:        t.HotelID,
			Quantity:       t.Quantity,
			AmountPaid:     t.AmountPaid,
			Status:         t.Status,
			IdempotencyKey: t.IdempotencyKey,
			TicketPayload:  t.TicketPayload,
			TicketHash:     t.TicketHash,
			BookingDate:    t.BookingDate,
			CreatedAt:      t.CreatedAt,
			CheckInDate:    t.CheckInDate,
			CheckOutDate:   t.CheckOutDate,
		}
		if t.DestinationID != nil && t.Destination.ID != 0 {
			item.Type = "destination"
			item.DestinationName = t.Destination.Name
			item.DestinationImage = t.Destination.ImageURL
		} else if t.TransportRouteID != nil && t.TransportRoute.ID != 0 {
			item.Type = "transport"
			item.TransportType = t.TransportRoute.Type
			item.OperatorName = t.TransportRoute.OperatorName
			item.OriginCity = t.TransportRoute.OriginCity
			item.DestCity = t.TransportRoute.DestCity
			item.SeatClass = t.TransportRoute.SeatClass
			dt := t.TransportRoute.DepartureTime
			at := t.TransportRoute.ArrivalTime
			item.DepartureTime = &dt
			item.ArrivalTime = &at
		} else if t.HotelID != nil && t.Hotel.ID != 0 {
			item.Type = "hotel"
			item.HotelName = t.Hotel.Name
			item.HotelCity = t.Hotel.City
			item.HotelImage = t.Hotel.ImageURL
			item.StarRating = t.Hotel.StarRating
			if t.CheckInDate != nil && t.CheckOutDate != nil {
				nights := int(t.CheckOutDate.Sub(*t.CheckInDate).Hours() / 24)
				if nights < 1 {
					nights = 1
				}
				item.NightCount = nights
			}
		}
		items = append(items, item)
	}
	return items, nil
}
