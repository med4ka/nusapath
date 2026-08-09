package handlers

import (
	"errors"
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/service"
)

type TransportHandler struct {
	svc *service.TransportService
}

func NewTransportHandler(svc *service.TransportService) *TransportHandler {
	return &TransportHandler{svc: svc}
}

// Mode without page/limit: full ARRAY response (same pattern as
// GET /api/destinations). Mode with page/limit: { data, meta }.
// Filters: type, origin_city, dest_city, date (departure date).
func (h *TransportHandler) List(c *fiber.Ctx) error {
	pageStr := c.Query("page")
	limitStr := c.Query("limit")
	paginated := pageStr != "" || limitStr != ""

	page, limit := 1, 12
	var err error
	if paginated {
		if pageStr != "" {
			page, err = strconv.Atoi(pageStr)
			if err != nil || page < 1 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query page tidak valid"})
			}
		}
		if limitStr != "" {
			limit, err = strconv.Atoi(limitStr)
			if err != nil || limit < 1 || limit > 50 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query limit tidak valid (1-50)"})
			}
		}
	}

	req := service.ListTransportRoutesRequest{
		Type:       c.Query("type"),
		OriginCity: c.Query("origin_city"),
		DestCity:   c.Query("dest_city"),
		Date:       c.Query("date"),
		Page:       page,
		Limit:      limit,
	}
	if !paginated {
		req.Page, req.Limit = 0, 0
	}

	routes, total, err := h.svc.List(c.UserContext(), req)
	if err != nil {
		log.Printf("transport handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal narik data rute transportasi"})
	}

	if !paginated {
		return c.JSON(routes)
	}

	totalPages := int64(0)
	if total > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}
	return c.JSON(fiber.Map{
		"data": routes,
		"meta": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

// Must be registered BEFORE /transport-routes/:id in main.go.
func (h *TransportHandler) Cities(c *fiber.Ctx) error {
	cities, err := h.svc.Cities(c.UserContext())
	if err != nil {
		log.Printf("transport handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menampilkan kota"})
	}
	return c.JSON(cities)
}

// 404 if soft-deleted.
func (h *TransportHandler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID rute tidak valid"})
	}

	route, err := h.svc.Get(c.UserContext(), uint(id))
	if err != nil {
		log.Printf("transport handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat detail rute"})
	}
	if route == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rute transportasi tidak ditemukan"})
	}
	return c.JSON(route)
}

func (h *TransportHandler) Create(c *fiber.Ctx) error {
	var req service.CreateTransportRouteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}
	route, err := h.svc.Create(c.UserContext(), req)
	if err != nil {
		return mapTransportError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(route)
}

// PUT partial — body {} → 400.
func (h *TransportHandler) Update(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	var req service.UpdateTransportRouteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}
	route, err := h.svc.Update(c.UserContext(), id, req)
	if err != nil {
		return mapTransportError(c, err)
	}
	return c.JSON(route)
}

// Soft delete if bookings exist, hard if none.
func (h *TransportHandler) Delete(c *fiber.Ctx) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return err
	}
	mode, err := h.svc.Delete(c.UserContext(), id)
	if err != nil {
		return mapTransportError(c, err)
	}
	return c.JSON(fiber.Map{
		"message": "Rute transportasi dihapus",
		"mode":    mode,
	})
}

func mapTransportError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidInput), errors.Is(err, service.ErrNoFieldsToUpdate):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrTransportRouteNotFound):
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rute transportasi tidak ditemukan"})
	default:
		log.Printf("transport handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
	}
}