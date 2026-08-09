package handlers

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type DestinationHandler struct {
	svc *service.DestinationService
}

func NewDestinationHandler(svc *service.DestinationService) *DestinationHandler {
	return &DestinationHandler{svc: svc}
}

// currentUserID — user_id from AuthOptional (0 if anonymous). Used
// to populate is_wishlisted in list/detail response.
func currentUserID(c *fiber.Ctx) uint {
	userID, _ := c.Locals(middleware.UserIDKey).(uint)
	return userID
}

// Mode without page/limit param: full ARRAY response (backward compatible
// with old frontend). Mode with page/limit: response
// { data, meta: { page, limit, total, total_pages } }.
func (h *DestinationHandler) List(c *fiber.Ctx) error {
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

	minPrice, err := parseQueryInt64(c, "min_price")
	if err != nil {
		return err
	}
	maxPrice, err := parseQueryInt64(c, "max_price")
	if err != nil {
		return err
	}

	req := service.ListDestinationsRequest{
		Search:   c.Query("search"),
		Category: c.Query("category"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
		Page:     page,
		Limit:    limit,
	}
	if !paginated {
		// Full array mode: no page/limit at all.
		req.Page, req.Limit = 0, 0
	}

	destinations, total, err := h.svc.List(c.UserContext(), req, currentUserID(c))
	if err != nil {
		log.Printf("destination handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal narik data destinasi"})
	}

	if !paginated {
		return c.JSON(destinations)
	}

	totalPages := int64(0)
	if total > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}
	return c.JSON(fiber.Map{
		"data": destinations,
		"meta": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func (h *DestinationHandler) Trending(c *fiber.Ctx) error {
	destinations, err := h.svc.Trending(c.UserContext(), currentUserID(c))
	if err != nil {
		log.Printf("destination handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menarik destinasi trending"})
	}
	return c.JSON(destinations)
}

func parseQueryInt64(c *fiber.Ctx, key string) (int64, error) {
	raw := c.Query(key)
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return 0, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Query " + key + " tidak valid"})
	}
	return value, nil
}

// 404 if soft-deleted.
func (h *DestinationHandler) Get(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID destinasi tidak valid"})
	}

	detail, err := h.svc.Get(c.UserContext(), uint(id), currentUserID(c))
	if err != nil {
		log.Printf("destination handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat detail destinasi"})
	}
	if detail == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Destinasi tidak ditemukan"})
	}

	return c.JSON(detail)
}
