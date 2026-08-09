package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type BookingHandler struct {
	svc *service.BookingService
}

func NewBookingHandler(svc *service.BookingService) *BookingHandler {
	return &BookingHandler{svc: svc}
}

func (h *BookingHandler) CreateBooking(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	var req service.BookingRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	transaction, created, promoMessage, err := h.svc.CreateBooking(c.UserContext(), userID, req)
	if err != nil {
		return mapBookingError(c, err)
	}

	status := fiber.StatusOK
	if created {
		status = fiber.StatusCreated
	}
	resp := fiber.Map{
		"message":     "Booking berhasil",
		"transaction": transaction,
	}
	if promoMessage != "" {
		resp["promo_message"] = promoMessage
	}
	return c.Status(status).JSON(resp)
}

func (h *BookingHandler) MyBookings(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	bookings, err := h.svc.MyBookings(c.UserContext(), userID)
	if err != nil {
		return mapBookingError(c, err)
	}

	return c.JSON(bookings)
}

// ConfirmPayment — POST /api/booking/:id/confirm-payment (Phase 3).
// Auth REQUIRED (route mounted after middleware.Auth). Does NOT read body
// at all — status/amount never comes from client. user_id
// taken from context cookie. Success response idempotent for bookings
// already PAID/TICKET_ISSUED (double-click / retry safe).
func (h *BookingHandler) ConfirmPayment(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID booking tidak valid"})
	}

	transaction, err := h.svc.ConfirmPayment(c.UserContext(), userID, uint(id))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrBookingNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Booking tidak ditemukan"})
		case errors.Is(err, service.ErrBookingNotOwned):
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Booking bukan milik kamu"})
		case errors.Is(err, service.ErrBookingFailed):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrInvalidInput):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		default:
			log.Printf("booking handler: error internal: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memproses pembayaran"})
		}
	}

	return c.JSON(fiber.Map{
		"message":     "Pembayaran berhasil",
		"transaction": transaction,
	})
}

func mapBookingError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrDestinationNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
	case errors.Is(err, service.ErrTransportRouteNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rute transportasi tidak ditemukan"})
	case errors.Is(err, service.ErrTransportSeatsUnavailable):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrIdempotencyConflict):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Idempotency key sudah dipakai user lain"})
	default:
		log.Printf("booking handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
	}
}

func (h *BookingHandler) Cancel(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID booking tidak valid"})
	}

	transaction, err := h.svc.CancelBooking(c.UserContext(), userID, uint(id))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrBookingNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Booking tidak ditemukan"})
		case errors.Is(err, service.ErrBookingNotOwned):
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Booking bukan milik kamu"})
		case errors.Is(err, service.ErrBookingTicketIssued):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrBookingFailed):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrBookingNotCancellable):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			log.Printf("booking handler: error cancel: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal membatalkan booking"})
		}
	}

	return c.JSON(fiber.Map{
		"message":     "Booking berhasil dibatalkan",
		"transaction": transaction,
	})
}

func (h *BookingHandler) VerifyTicket(c *fiber.Ctx) error {
	hash := c.Params("hash")
	if hash == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Hash tiket tidak valid"})
	}

	result, err := h.svc.VerifyTicket(c.UserContext(), hash)
	if err != nil {
		if errors.Is(err, service.ErrTicketNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Tiket tidak ditemukan atau tidak valid"})
		}
		log.Printf("booking handler: error verify: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memverifikasi tiket"})
	}

	return c.JSON(result)
}
