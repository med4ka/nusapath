package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type PromoHandler struct {
	svc *service.PromoService
}

func NewPromoHandler(svc *service.PromoService) *PromoHandler {
	return &PromoHandler{svc: svc}
}

func (h *PromoHandler) Validate(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	var req service.ValidatePromoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	result, err := h.svc.Validate(c.UserContext(), userID, req)
	if err != nil {
		return mapPromoError(c, err)
	}

	return c.JSON(result)
}

func (h *PromoHandler) List(c *fiber.Ctx) error {
	promos, err := h.svc.List(c.UserContext())
	if err != nil {
		return mapPromoError(c, err)
	}
	return c.JSON(promos)
}

func (h *PromoHandler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID promo tidak valid"})
	}

	promo, usages, err := h.svc.Get(c.UserContext(), uint(id))
	if err != nil {
		return mapPromoError(c, err)
	}

	return c.JSON(fiber.Map{
		"promo":  promo,
		"usages": usages,
	})
}

func (h *PromoHandler) Create(c *fiber.Ctx) error {
	var req service.CreatePromoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	promo, err := h.svc.Create(c.UserContext(), req)
	if err != nil {
		return mapPromoError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(promo)
}

func (h *PromoHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID promo tidak valid"})
	}

	var req service.UpdatePromoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	promo, err := h.svc.Update(c.UserContext(), uint(id), req)
	if err != nil {
		return mapPromoError(c, err)
	}
	return c.JSON(promo)
}

func (h *PromoHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID promo tidak valid"})
	}

	if err := h.svc.Delete(c.UserContext(), uint(id)); err != nil {
		return mapPromoError(c, err)
	}
	return c.JSON(fiber.Map{"message": "Kode promo dihapus"})
}

func mapPromoError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidInput), errors.Is(err, service.ErrPromoNoFields), errors.Is(err, service.ErrPromoInvalidValue):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrPromoNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": err.Error()})
	default:
		log.Printf("promo handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
	}
}
