package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/service"
)

type HotelHandler struct {
	svc *service.HotelService
}

func NewHotelHandler(svc *service.HotelService) *HotelHandler {
	return &HotelHandler{svc: svc}
}

func (h *HotelHandler) List(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page"))
	limit, _ := strconv.Atoi(c.Query("limit"))
	if limit < 0 || limit > 50 {
		limit = 0
	}
	if page < 1 {
		page = 1
	}

	minPrice, _ := strconv.ParseInt(c.Query("min_price"), 10, 64)
	maxPrice, _ := strconv.ParseInt(c.Query("max_price"), 10, 64)
	starRating, _ := strconv.Atoi(c.Query("star_rating"))

	req := service.ListHotelsRequest{
		City:       c.Query("city"),
		MinPrice:   minPrice,
		MaxPrice:   maxPrice,
		StarRating: starRating,
		Page:       page,
		Limit:      limit,
	}

	hotels, total, err := h.svc.List(c.UserContext(), req)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal mengambil data hotel"})
	}

	if limit > 0 {
		totalPages := int64(1)
		if limit > 0 {
			totalPages = (total + int64(limit) - 1) / int64(limit)
		}
		return c.JSON(fiber.Map{
			"data": hotels,
			"meta": fiber.Map{
				"page":        page,
				"limit":       limit,
				"total":       total,
				"total_pages": totalPages,
			},
		})
	}
	return c.JSON(hotels)
}

func (h *HotelHandler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID hotel tidak valid"})
	}

	hotel, err := h.svc.Get(c.UserContext(), uint(id))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal mengambil detail hotel"})
	}
	if hotel == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Hotel tidak ditemukan"})
	}
	return c.JSON(hotel)
}

func (h *HotelHandler) Cities(c *fiber.Ctx) error {
	cities, err := h.svc.Cities(c.UserContext())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal mengambil daftar kota"})
	}
	return c.JSON(cities)
}

func (h *HotelHandler) Create(c *fiber.Ctx) error {
	var req service.CreateHotelRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format body tidak valid"})
	}

	hotel, err := h.svc.Create(c.UserContext(), req)
	if err != nil {
		if svcErr, ok := err.(interface{ Unwrap() error }); ok && svcErr.Unwrap() == service.ErrInvalidInput {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Gagal membuat hotel"})
	}
	return c.Status(201).JSON(hotel)
}

func (h *HotelHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID hotel tidak valid"})
	}

	var req service.UpdateHotelRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Format body tidak valid"})
	}

	hotel, err := h.svc.Update(c.UserContext(), uint(id), req)
	if err != nil {
		if err == service.ErrHotelNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Hotel tidak ditemukan"})
		}
		if err == service.ErrNoFieldsToUpdate {
			return c.Status(400).JSON(fiber.Map{"error": "Tidak ada field yang diupdate"})
		}
		if svcErr, ok := err.(interface{ Unwrap() error }); ok && svcErr.Unwrap() == service.ErrInvalidInput {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Gagal mengupdate hotel"})
	}
	return c.JSON(hotel)
}

func (h *HotelHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID hotel tidak valid"})
	}

	mode, err := h.svc.Delete(c.UserContext(), uint(id))
	if err != nil {
		if err == service.ErrHotelNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Hotel tidak ditemukan"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Gagal menghapus hotel"})
	}
	return c.JSON(fiber.Map{"message": "Hotel berhasil dihapus", "mode": mode})
}
