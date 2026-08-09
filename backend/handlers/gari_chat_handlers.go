package handlers

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/service"
)

type GariChatHandler struct {
	svc *service.GariChatService
}

func NewGariChatHandler(svc *service.GariChatService) *GariChatHandler {
	return &GariChatHandler{svc: svc}
}

// Auth REQUIRED. Rate limit per user per day (WIB) → 402.
func (h *GariChatHandler) Chat(c *fiber.Ctx) error {
	var req service.GariChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	userID := currentUserID(c) // Auth required → always > 0

	resp, err := h.svc.Chat(c.UserContext(), userID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrGariRateLimit):
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{"error": err.Error()})
		case errors.Is(err, service.ErrInvalidInput):
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		default:
			log.Printf("gari chat handler: error internal: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memproses obrolan dengan Gari"})
		}
	}

	return c.JSON(resp)
}