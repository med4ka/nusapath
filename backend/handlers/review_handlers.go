package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type ReviewHandler struct {
	svc *service.ReviewService
}

func NewReviewHandler(svc *service.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// Auth REQUIRED. Rating 1–5, comment optional. Requirement: user must have a
// TICKET_ISSUED transaction for this destination that has not been reviewed.
func (h *ReviewHandler) Create(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID destinasi tidak valid"})
	}

	var req service.CreateReviewRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	review, err := h.svc.Create(c.UserContext(), userID, uint(id), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrDestinationNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
		case errors.Is(err, service.ErrNoEligibleBooking):
		// Clear message per Batch 2 instructions — user is not eligible to review.
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrAlreadyReviewed):
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		default:
			log.Printf("review handler: error internal: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menyimpan ulasan"})
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Ulasan berhasil dikirim",
		"review":  review,
	})
}

func (h *ReviewHandler) List(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID destinasi tidak valid"})
	}

	list, err := h.svc.List(c.UserContext(), uint(id))
	if err != nil {
		if errors.Is(err, service.ErrDestinationNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
		}
		log.Printf("review handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat ulasan"})
	}

	return c.JSON(list)
}