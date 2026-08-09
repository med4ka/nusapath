package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type BookingRepository struct {
	db *gorm.DB
}

func NewBookingRepository(db *gorm.DB) *BookingRepository {
	return &BookingRepository{db: db}
}

func (r *BookingRepository) Create(ctx context.Context, transaction *models.Transaction) error {
	return r.db.WithContext(ctx).Create(transaction).Error
}

// FindByUserID — transaction history for one user. No Preload — User/Destination
// association fields set json:"-", so response stays flat.
func (r *BookingRepository) FindByUserID(ctx context.Context, userID uint) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&transactions).Error
	if err != nil {
		return nil, err
	}
	return transactions, nil
}

// FindByUserIDWithDestination — transaction history with preloaded associations
// FOR display (destination name+photo OR transport route OR hotel).
// All associations preloaded with Unscoped so old transactions referencing
// soft-deleted items can still show name & photo. Association fields remain
// json:"-" — service maps them to BookingHistoryItem.
func (r *BookingRepository) FindByUserIDWithDestination(ctx context.Context, userID uint) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Preload("Destination", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Preload("TransportRoute", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Preload("Hotel", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Order("created_at DESC").
		Find(&transactions).Error
	if err != nil {
		return nil, err
	}
	return transactions, nil
}

// FindByID — lookup 1 transaction (used by confirm-payment for ownership &
// status validation). Soft-deleted transactions are not found (default gorm scope).
func (r *BookingRepository) FindByID(ctx context.Context, id uint) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.WithContext(ctx).First(&transaction, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// UpdateStatusWherePending — atomic transition PENDING_PAYMENT → new status.
// RowsAffected 0 means status already changed elsewhere (race / already
// processed) — prevents double-charge for two parallel confirm-payment requests.
func (r *BookingRepository) UpdateStatusWherePending(ctx context.Context, id uint, newStatus string) (bool, error) {
	res := r.db.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("id = ? AND status = ?", id, models.StatusPendingPayment).
		Update("status", newStatus)
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func (r *BookingRepository) Update(ctx context.Context, transaction *models.Transaction) error {
	return r.db.WithContext(ctx).Save(transaction).Error
}

func (r *BookingRepository) FindByIdempotencyKey(ctx context.Context, key string) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.WithContext(ctx).Where("idempotency_key = ?", key).First(&transaction).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}

// CountByDestinationID — used by AdminService when deleting destination: >0 means
// soft delete, 0 means hard delete. Includes transactions of any status
// (even FAILED is still history).
func (r *BookingRepository) CountByDestinationID(ctx context.Context, destinationID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Transaction{}).Where("destination_id = ?", destinationID).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}

func (r *BookingRepository) CountByTransportRouteID(ctx context.Context, routeID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Transaction{}).Where("transport_route_id = ?", routeID).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}

// ErrInsufficientSeats — sentinel repository: not enough seats. Mapped by
// service to ErrTransportSeatsUnavailable (409). Must not import service
// package from here (dependency direction repository → service is forbidden).
var ErrInsufficientSeats = errors.New("kursi transportasi tidak mencukupi")

// CreateTransportBooking — atomic transport transaction insert with seat
// deduction in ONE DB transaction:
//   1. UPDATE transport_routes SET available_seats = available_seats - qty
//      WHERE id = ? AND available_seats >= qty (stock check evaluated in a
//      single statement — RowsAffected 0 → insufficient seats, rollback)
//   2. INSERT transaction (booking PENDING_PAYMENT)
// If step 2 fails (e.g. duplicate idempotency key / other constraint),
// entire transaction rolls back → seats are automatically restored. This
// prevents race double-deduct for parallel requests and prevents "lost"
// seats for failed bookings.
func (r *BookingRepository) CreateTransportBooking(ctx context.Context, transaction *models.Transaction, qty int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.TransportRoute{}).
			Where("id = ? AND available_seats >= ?", *transaction.TransportRouteID, qty).
			Update("available_seats", gorm.Expr("available_seats - ?", qty))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInsufficientSeats
		}
		return tx.Create(transaction).Error
	})
}

// CountByPromoID — number of transactions using a specific promo code.
func (r *BookingRepository) CountByPromoID(ctx context.Context, promoID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Transaction{}).Where("promo_code_id = ?", promoID).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}

// UpdatePromoApplied — set promo_code_id, discount_amount, amount_paid final.
func (r *BookingRepository) UpdatePromoApplied(ctx context.Context, bookingID, promoID uint, discountAmount, finalAmount int64) error {
	return r.db.WithContext(ctx).Model(&models.Transaction{}).
		Where("id = ?", bookingID).
		Updates(map[string]interface{}{
			"promo_code_id":   promoID,
			"discount_amount": discountAmount,
			"amount_paid":     finalAmount,
		}).Error
}

func (r *BookingRepository) CreateHotelBooking(ctx context.Context, transaction *models.Transaction) error {
	return r.db.WithContext(ctx).Create(transaction).Error
}

// CountByHotelID — >0 means soft delete, 0 means hard delete.
func (r *BookingRepository) CountByHotelID(ctx context.Context, hotelID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Transaction{}).Where("hotel_id = ?", hotelID).Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}

// ErrAlreadyCancelled — sentinel: booking already cancelled or not pending.
var ErrAlreadyCancelled = errors.New("booking sudah dibatalkan atau tidak dalam status PENDING_PAYMENT")

// CancelBooking — atomic cancel in ONE DB transaction:
// 1. UPDATE transaction SET status = CANCELLED WHERE id=? AND status=PENDING_PAYMENT (RowsAffected 0 → already changed)
// 2. IF transport booking: UPDATE transport_routes SET available_seats = available_seats + qty
// 3. IF promo was applied & promo per_user_limit=true: DELETE promo_code_usage row
// Returns (ok bool, err error) — ok=false means status was not PENDING_PAYMENT.
func (r *BookingRepository) CancelBooking(ctx context.Context, id uint, transportRouteID *uint, qty int64, promoCodeID *uint) (bool, error) {
	var ok bool
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&models.Transaction{}).
			Where("id = ? AND status = ?", id, models.StatusPendingPayment).
			Update("status", models.StatusCancelled)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrAlreadyCancelled
		}
		ok = true

		// Restore transport seats if applicable.
		if transportRouteID != nil && qty > 0 {
			if err := tx.Model(&models.TransportRoute{}).
				Where("id = ?", *transportRouteID).
				Update("available_seats", gorm.Expr("available_seats + ?", qty)).Error; err != nil {
				return err
			}
		}

		// Remove promo usage if promo was applied AND it is per_user_limit.
		if promoCodeID != nil {
			var promo models.PromoCode
			if err := tx.First(&promo, *promoCodeID).Error; err != nil {
				return err
			}
			// Only restore usage slot when per_user_limit is true (or nil = default true).
			perUserLimit := true
			if promo.PerUserLimit != nil {
				perUserLimit = *promo.PerUserLimit
			}
			if perUserLimit {
				if err := tx.Where("promo_code_id = ? AND transaction_id = ?", *promoCodeID, id).
					Delete(&models.PromoCodeUsage{}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	return ok, err
}

// FindByTicketHash — lookup transaction by ticket_hash (public verification).
// Only returns TICKET_ISSUED transactions. Includes preloaded associations
// for display (Unscoped — soft-deleted items still resolve).
func (r *BookingRepository) FindByTicketHash(ctx context.Context, hash string) (*models.Transaction, error) {
	var transaction models.Transaction
	err := r.db.WithContext(ctx).
		Preload("User").
		Preload("Destination", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Preload("TransportRoute", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Preload("Hotel", func(db *gorm.DB) *gorm.DB { return db.Unscoped() }).
		Where("ticket_hash = ? AND status = ?", hash, models.StatusTicketIssued).
		First(&transaction).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &transaction, nil
}
