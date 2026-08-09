package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/service"
)

// All methods in this handler MUST be protected by
// middleware.Auth + middleware.RequireRole("admin") — guaranteed in main.go,
// handler does not perform role checking itself (no duplication).

type AdminHandler struct {
	svc *service.AdminService
}

func NewAdminHandler(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

func parseIDParam(c *fiber.Ctx, key string) (uint, error) {
	id, err := strconv.ParseUint(c.Params(key), 10, 64)
	if err != nil || id == 0 {
		return 0, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID tidak valid"})
	}
	return uint(id), nil
}

func (h *AdminHandler) CreateDestination(c *fiber.Ctx) error {
	var req service.CreateDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	destination, err := h.svc.CreateDestination(c.UserContext(), req)
	if err != nil {
		return mapAdminError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(destination)
}

func (h *AdminHandler) UpdateDestination(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}

	var req service.UpdateDestinationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	destination, err := h.svc.UpdateDestination(c.UserContext(), id, req)
	if err != nil {
		return mapAdminError(c, err)
	}
	return c.JSON(destination)
}

func (h *AdminHandler) DeleteDestination(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}

	mode, err := h.svc.DeleteDestination(c.UserContext(), id)
	if err != nil {
		return mapAdminError(c, err)
	}

	// mode: "soft" = hidden (deleted_at, old transactions intact),
	// "hard" = row permanently deleted (no bookings at all).
	return c.JSON(fiber.Map{
		"message": "Destinasi dihapus",
		"mode":    mode,
	})
}

func (h *AdminHandler) AddImage(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}

	var req service.AddImageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	image, err := h.svc.AddImage(c.UserContext(), id, req)
	if err != nil {
		return mapAdminError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(image)
}

func (h *AdminHandler) RemoveImage(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	imageID, err := parseIDParam(c, "imageId")
	if err != nil {
		return err
	}

	if err := h.svc.RemoveImage(c.UserContext(), id, imageID); err != nil {
		return mapAdminError(c, err)
	}
	return c.JSON(fiber.Map{"message": "Foto dihapus"})
}

func mapAdminError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidInput), errors.Is(err, service.ErrNoFieldsToUpdate):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrDestinationNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
	case errors.Is(err, service.ErrImageNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Foto tidak ditemukan"})
	default:
		log.Printf("admin handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
	}
}
