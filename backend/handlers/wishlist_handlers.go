package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type WishlistHandler struct {
	svc *service.WishlistService
}

func NewWishlistHandler(svc *service.WishlistService) *WishlistHandler {
	return &WishlistHandler{svc: svc}
}

// user_id from context cookie, NOT from body.
func (h *WishlistHandler) Toggle(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	id, err := strconv.ParseUint(c.Params("destinationId"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID destinasi tidak valid"})
	}

	wishlisted, err := h.svc.Toggle(c.UserContext(), userID, uint(id))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrDestinationNotFound):
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
		default:
			log.Printf("wishlist handler: error internal: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
		}
	}

	message := "Dihapus dari wishlist"
	if wishlisted {
		message = "Ditambahkan ke wishlist"
	}
	return c.JSON(fiber.Map{
		"message":    message,
		"wishlisted": wishlisted,
	})
}

func (h *WishlistHandler) ListMe(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	items, err := h.svc.ListMe(c.UserContext(), userID)
	if err != nil {
		log.Printf("wishlist handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat wishlist"})
	}
	return c.JSON(items)
}