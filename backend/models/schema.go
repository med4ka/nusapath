package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	// RoleUser / RoleAdmin — valid values for User.Role. By decision,
	// role MUST NOT be in service register (client never sends role),
	// only changeable via direct DB access (DBA/manual promote).
	RoleUser  = "user"
	RoleAdmin = "admin"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	Email        string    `gorm:"type:varchar(150);not null;uniqueIndex" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	// Role stored in JWT at login — role changes in DB only take effect
	// after user re-login (middleware reads role from token, no DB query per request).
	Role      string    `gorm:"type:varchar(20);not null;default:'user';index" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Destination struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Name     string `gorm:"type:varchar(150);not null;index:idx_destinations_name" json:"name"`
	Category string `gorm:"type:varchar(50);index:idx_destinations_category" json:"category"`
	Description string  `gorm:"type:text" json:"description"`
	Price       int64   `gorm:"not null" json:"price"`
	Rating      float64 `gorm:"type:decimal(2,1)" json:"rating"`
	// DEPRECATED: temporary fallback only — will be removed after all
	// destinations migrate to DestinationImage table. Don't use this field
	// for new data; upload photos via POST /api/admin/destinations/:id/images.
	ImageURL string `gorm:"type:varchar(255)" json:"image_url"`
	// Soft delete: destinations with booking history must not be permanently
	// lost (FK RESTRICT on transactions), so deleted via DeletedAt.
	// Destinations without bookings are hard-deleted.
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type DestinationImage struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	DestinationID uint         `gorm:"not null;index" json:"destination_id"`
	Destination   Destination  `gorm:"foreignKey:DestinationID;constraint:OnDelete:CASCADE" json:"-"`
	ImageURL      string       `gorm:"type:varchar(255);not null" json:"image_url"`
	SortOrder     int          `gorm:"not null;default:0" json:"sort_order"`
	IsPrimary     bool         `gorm:"not null;default:false" json:"is_primary"`
}

// DestinationListItem — destination list row + photo count (calculated via
// LEFT JOIN subquery in repository). Used by GET /api/destinations response
// so UI (including admin panel) can display "photo count" column
// without N+1 queries.
type DestinationListItem struct {
	Destination
	ImagesCount int64 `json:"images_count"`
	// IsWishlisted populated ONLY when user is logged in (wishlist Batch 2).
	// Pointer + omitempty → field does not appear in JSON at all for
	// anonymous requests; public endpoints do not leak wishlist data.
	IsWishlisted *bool `json:"is_wishlisted,omitempty"`
}

// DestinationDetail — detail of 1 destination + photo list (sorted by
// sort_order). Used by GET /api/destinations/:id response so UI
// (admin panel & later destination detail page) can display and
// manage existing photos.
type DestinationDetail struct {
	Destination
	Images       []DestinationImage `json:"images"`
	IsWishlisted *bool              `json:"is_wishlisted,omitempty"`
}

// Wishlist — user's favorite of a destination. Unique (user_id,
// destination_id) guarantees no duplicates; POST /api/wishlist/:id acts as
// toggle (insert if not exists, delete if exists) — Batch 2.
type Wishlist struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	UserID        uint        `gorm:"not null;uniqueIndex:idx_wishlist_user_destination" json:"user_id"`
	User          User        `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	DestinationID uint        `gorm:"not null;uniqueIndex:idx_wishlist_user_destination" json:"destination_id"`
	Destination   Destination `gorm:"foreignKey:DestinationID;constraint:OnDelete:CASCADE" json:"-"`
	CreatedAt     time.Time   `json:"created_at"`
}

// WishlistItem — a destination wishlisted by user (GET /api/wishlist/me),
// denormalized from JOIN wishlists × destinations. Rating RE-calculated from
// actual reviews if any (consistent with GET /api/destinations), fallback to
// old Rating field if no reviews.
type WishlistItem struct {
	Destination
	WishlistID        uint      `json:"wishlist_id"`
	ImagesCount       int64     `json:"images_count"`
	WishlistCreatedAt time.Time `json:"wishlist_created_at"`
}

const (
	// Transaction status — flow: PENDING_PAYMENT → PAID → TICKET_ISSUED (or FAILED).
	// CANCELLED — user-cancelled before payment (PENDING_PAYMENT only).
	StatusPendingPayment = "PENDING_PAYMENT"
	StatusPaid           = "PAID"
	StatusTicketIssued   = "TICKET_ISSUED"
	StatusFailed         = "FAILED"
	StatusCancelled      = "CANCELLED"
)

const (
	// Transport route type — strict enum.
	TransportFlight = "flight"
	TransportTrain  = "train"
	TransportBus    = "bus"
)

// TransportRoute — transport schedule (flight/train/bus) managed MANUALLY
// by admin (NOT live-tracking from airlines/KAI; no free official API for
// prototype). AvailableSeats decremented ATOMICALLY in repository on each
// successful booking (WHERE available_seats >= qty), stock check pattern.
type TransportRoute struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Type          string    `gorm:"type:varchar(10);not null;index:idx_transport_route_type" json:"type"`
	OperatorName  string    `gorm:"type:varchar(100);not null" json:"operator_name"`
	OriginCity    string    `gorm:"type:varchar(100);not null;index:idx_transport_route_origin" json:"origin_city"`
	DestCity      string    `gorm:"type:varchar(100);not null;index:idx_transport_route_dest" json:"dest_city"`
	DepartureTime time.Time `gorm:"not null;index" json:"departure_time"`
	ArrivalTime   time.Time `gorm:"not null" json:"arrival_time"`
	// Price int64 — principle SAME as Destination: single source of truth
	// for price, amount_paid calculated server-side (price × quantity).
	Price int64 `gorm:"not null" json:"price"`
	// SeatClass — e.g. "Ekonomi"/"Bisnis"/"Eksekutif".
	SeatClass      string `gorm:"type:varchar(50)" json:"seat_class"`
	TotalSeats     int    `gorm:"not null" json:"total_seats"`
	AvailableSeats int    `gorm:"not null" json:"available_seats"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	// Soft delete — same pattern as destinations: routes with booking
	// history must not be permanently lost (FK RESTRICT), deleted via DeletedAt.
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Transaction struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	UserID         uint           `gorm:"not null;index" json:"user_id"`
	User           User           `gorm:"foreignKey:UserID;constraint:OnDelete:RESTRICT" json:"-"`
	// Transport generalization (Session 36): booking fills EXACTLY ONE of
	// DestinationID OR TransportRouteID (validated in BookingService,
	// not just documentation). Pointer → nullable column, unfilled one
	// stored as NULL (not 0) to keep FK RESTRICT intact.
	DestinationID    *uint          `gorm:"index" json:"destination_id"`
	Destination      Destination    `gorm:"foreignKey:DestinationID;constraint:OnDelete:RESTRICT" json:"-"`
	TransportRouteID *uint          `gorm:"index" json:"transport_route_id"`
	TransportRoute   TransportRoute `gorm:"foreignKey:TransportRouteID;constraint:OnDelete:RESTRICT" json:"-"`
	// HotelID — nullable FK for hotel booking (Session hotel).
	// Exactly-one validation extended to three-way in BookingService.
	HotelID    *uint  `gorm:"index" json:"hotel_id,omitempty"`
	Hotel      Hotel  `gorm:"foreignKey:HotelID;constraint:OnDelete:RESTRICT" json:"-"`
	// CheckInDate / CheckOutDate — hotel booking dates (nullable).
	CheckInDate  *time.Time `json:"check_in_date,omitempty"`
	CheckOutDate *time.Time `json:"check_out_date,omitempty"`
	// Quantity — ticket count in one booking (Batch 2). For destinations:
	// server-side multiplier (AmountPaid = Destination.Price × Quantity,
	// validation 1–10). For transport: NUMBER OF SEATS booked
	// (AmountPaid = TransportRoute.Price × Quantity, validation
	// available_seats >= quantity in repository). Client NEVER sends
	// amount_paid — same principle from the start.
	Quantity     int64          `gorm:"not null;default:1" json:"quantity"`
	AmountPaid   int64          `gorm:"not null" json:"amount_paid"`
	// PromoCodeID — nullable FK to the promo code used (if any).
	// DiscountAmount — how much rupiah discount given, calculated &
	// stored server-side when booking created (not from client).
	PromoCodeID    *uint          `gorm:"index" json:"promo_code_id,omitempty"`
	PromoCode      PromoCode      `gorm:"foreignKey:PromoCodeID;constraint:OnDelete:RESTRICT" json:"-"`
	DiscountAmount int64          `gorm:"not null;default:0" json:"discount_amount"`
	Status       string         `gorm:"type:varchar(20);not null;default:'PENDING_PAYMENT';index" json:"status"`
	IdempotencyKey string       `gorm:"type:varchar(64);not null;uniqueIndex" json:"idempotency_key"`
	TicketPayload  string       `gorm:"type:text" json:"ticket_payload"`
	TicketHash     string       `gorm:"type:varchar(255)" json:"ticket_hash"`
	BookingDate    time.Time    `json:"booking_date"`
	CreatedAt      time.Time    `json:"created_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// Review — actual user review of destination, tied to ONE transaction
// (uniqueIndex transaction_id → one booking can only be reviewed once).
// Rating 1–5 enforced by service (CreateReviewRequest validator); comment
// optional. UserName denormalized into response via ReviewDetail
// (User association field set to json:"-", so transaction does not leak).
type Review struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	UserID        uint         `gorm:"not null;index" json:"user_id"`
	User          User         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	DestinationID uint         `gorm:"not null;index" json:"destination_id"`
	Destination   Destination  `gorm:"foreignKey:DestinationID;constraint:OnDelete:CASCADE" json:"-"`
	// TransactionID UNIQUE — one TICKET_ISSUED transaction can only be
	// reviewed once (also enforced in service layer with clear error message).
	TransactionID uint        `gorm:"not null;uniqueIndex" json:"-"`
	Transaction   Transaction `gorm:"foreignKey:TransactionID;constraint:OnDelete:RESTRICT" json:"-"`
	Rating        int         `gorm:"not null" json:"rating"`
	Comment       string      `gorm:"type:text" json:"comment"`
	CreatedAt     time.Time   `json:"created_at"`
}

// ReviewDetail — one review + user name (from reviewer) for GET
// /api/destinations/:id/reviews. Embed Review (TransactionID remains
// json:"-" in model).
type ReviewDetail struct {
	Review
	UserName string `json:"user_name"`
}

// ReviewList — GET /api/destinations/:id/reviews response: review list
// + actual average rating. AverageRating pointer → nil when no reviews
// yet (does not appear in JSON); ReviewCount always included.
type ReviewList struct {
	DestinationID uint            `json:"destination_id"`
	AverageRating *float64        `json:"average_rating,omitempty"`
	ReviewCount   int64           `json:"rating_count"`
	Reviews       []ReviewDetail  `json:"reviews"`
}

// BookingHistoryItem — one transaction history row for GET /api/bookings/me.
// Transaction association fields (User/Destination/TransportRoute/Hotel) set to
// json:"-", so destination/transport/hotel details are denormalized here so
// frontend (history page & ticket detail) does not need additional queries.
// `type` = "destination" | "transport" | "hotel" — frontend uses this to
// decide card rendering.
// DestinationName/... still available for soft-deleted items (preload
// Unscoped) — old transactions must remain displayable.
type BookingHistoryItem struct {
	ID               uint      `json:"id"`
	UserID           uint      `json:"user_id"`
	Type             string    `json:"type"`
	DestinationID    *uint     `json:"destination_id,omitempty"`
	TransportRouteID *uint     `json:"transport_route_id,omitempty"`
	HotelID          *uint     `json:"hotel_id,omitempty"`
	// ——— Destination fields (only populated when Type == "destination") ———
	DestinationName  string    `json:"destination_name,omitempty"`
	DestinationImage string    `json:"destination_image,omitempty"`
	// ——— Transport fields (only populated when Type == "transport") ———
	TransportType     string     `json:"transport_type,omitempty"`
	OperatorName      string     `json:"operator_name,omitempty"`
	OriginCity        string     `json:"origin_city,omitempty"`
	DestCity          string     `json:"dest_city,omitempty"`
	DepartureTime     *time.Time `json:"departure_time,omitempty"`
	ArrivalTime       *time.Time `json:"arrival_time,omitempty"`
	SeatClass         string     `json:"seat_class,omitempty"`
	// ——— Hotel fields (only populated when Type == "hotel") ———
	HotelName     string     `json:"hotel_name,omitempty"`
	HotelCity     string     `json:"hotel_city,omitempty"`
	HotelImage    string     `json:"hotel_image,omitempty"`
	CheckInDate   *time.Time `json:"check_in_date,omitempty"`
	CheckOutDate  *time.Time `json:"check_out_date,omitempty"`
	NightCount    int        `json:"night_count,omitempty"`
	StarRating    int        `json:"star_rating,omitempty"`
	// ——— Shared fields ———
	Quantity          int64      `json:"quantity"`
	AmountPaid        int64      `json:"amount_paid"`
	Status            string     `json:"status"`
	IdempotencyKey    string     `json:"idempotency_key"`
	TicketPayload     string     `json:"ticket_payload"`
	TicketHash        string     `json:"ticket_hash"`
	BookingDate       time.Time  `json:"booking_date"`
	CreatedAt         time.Time  `json:"created_at"`
}

type Facility struct {
	ID          uint    `gorm:"primaryKey" json:"id"`
	Name        string  `gorm:"type:varchar(100);not null" json:"name"`
	Type        string  `gorm:"type:varchar(50)" json:"type"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	PhoneNumber string  `gorm:"type:varchar(20)" json:"phone_number"`
}

// TicketVerifyResponse — public response for GET /api/tickets/verify/:hash.
// Intentionally limited: no email, no full name, no contact info.
type TicketVerifyResponse struct {
	Valid       bool      `json:"valid"`
	ItemType    string    `json:"item_type"`
	ItemName    string    `json:"item_name"`
	AmountPaid  int64     `json:"amount_paid"`
	BookingDate time.Time `json:"booking_date"`
	TicketHash  string    `json:"ticket_hash"`
	UserInitial string    `json:"user_initial"`
}

// Hotel — accommodation lodging. Managed manually via seed/admin.
// Bookable via POST /api/booking with hotel_id + check_in/out dates.
type Hotel struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Name          string         `gorm:"type:varchar(150);not null" json:"name"`
	City          string         `gorm:"type:varchar(100);not null;index" json:"city"`
	PricePerNight int64          `gorm:"not null" json:"price_per_night"`
	StarRating    int            `gorm:"not null;default:3" json:"star_rating"`
	Description   string         `gorm:"type:text" json:"description"`
	ImageURL      string         `gorm:"type:varchar(255)" json:"image_url"`
	Amenities     string         `gorm:"type:text" json:"amenities"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// GariChatLog — chat attempt log per user (cost control). One row
// per attempt (success OR Gemini failure), used for daily rate limit
// calculation (max GariDailyLimit per WIB day). Row still inserted
// even if Gemini fails, so user cannot spam retry to "reset" limit.
type GariChatLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Message   string    `gorm:"type:varchar(500)" json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

// PromoCode — discount/promo code. Created & managed by admin; used by user
// during booking. All discount calculation done server-side (price never
// from client).
type PromoCode struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Code          string    `gorm:"type:varchar(50);not null;uniqueIndex" json:"code"`
	DiscountType  string    `gorm:"type:varchar(20);not null" json:"discount_type"` // "percentage" or "fixed"
	DiscountValue int64     `gorm:"not null" json:"discount_value"`
	MinPurchase   *int64    `gorm:"" json:"min_purchase,omitempty"`
	MaxDiscount   *int64    `gorm:"" json:"max_discount,omitempty"`
	ValidFrom     time.Time `gorm:"not null" json:"valid_from"`
	ValidUntil    time.Time `gorm:"not null" json:"valid_until"`
	UsageLimit    *int      `gorm:"" json:"usage_limit,omitempty"`
	UsageCount    int       `gorm:"not null;default:0" json:"usage_count"`
	PerUserLimit  *bool     `gorm:"not null;default:true" json:"per_user_limit"`
	IsActive      bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// PromoCodeUsage — promo usage tracking per user. Unique (promo_code_id,
// user_id) prevents user from using the same code twice if PerUserLimit true.
type PromoCodeUsage struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	PromoCodeID   uint      `gorm:"not null;uniqueIndex:idx_promo_usage" json:"promo_code_id"`
	PromoCode     PromoCode `gorm:"foreignKey:PromoCodeID;constraint:OnDelete:RESTRICT" json:"-"`
	UserID        uint      `gorm:"not null;uniqueIndex:idx_promo_usage" json:"user_id"`
	User          User      `gorm:"foreignKey:UserID;constraint:OnDelete:RESTRICT" json:"-"`
	TransactionID uint      `gorm:"not null;index" json:"transaction_id"`
	Transaction   Transaction `gorm:"foreignKey:TransactionID;constraint:OnDelete:RESTRICT" json:"-"`
	CreatedAt     time.Time `json:"created_at"`
}

type PromoCodeAdminItem struct {
	PromoCode
	UsageDetails []PromoCodeUsage `json:"usage_details,omitempty"`
}

// Notification — centralized notification for user. Created automatically
// by service layer on certain events (booking created, payment successful,
// promo used).
type Notification struct {
	ID                   uint         `gorm:"primaryKey" json:"id"`
	UserID               uint         `gorm:"not null;index" json:"user_id"`
	User                 User         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Type                 string       `gorm:"type:varchar(30);not null;index" json:"type"`
	Title                string       `gorm:"type:varchar(200);not null" json:"title"`
	Message              string       `gorm:"type:text;not null" json:"message"`
	IsRead               bool         `gorm:"not null;default:false;index" json:"is_read"`
	RelatedTransactionID *uint        `gorm:"index" json:"related_transaction_id,omitempty"`
	Transaction          Transaction  `gorm:"foreignKey:RelatedTransactionID;constraint:OnDelete:SET NULL" json:"-"`
	CreatedAt            time.Time    `json:"created_at"`
}
