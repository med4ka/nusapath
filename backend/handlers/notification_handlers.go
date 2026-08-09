package handlers

import (
	"log"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/service"
)

type NotificationHandler struct {
	svc *service.NotificationService
}

func NewNotificationHandler(svc *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: svc}
}

func (h *NotificationHandler) List(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	page, limit := 1, 20
	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v >= 1 {
			page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v >= 1 && v <= 50 {
			limit = v
		}
	}

	notifications, total, err := h.svc.List(c.UserContext(), userID, page, limit)
	if err != nil {
		log.Printf("notification handler: list error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat notifikasi"})
	}

	totalPages := int64(0)
	if total > 0 {
		totalPages = (total + int64(limit) - 1) / int64(limit)
	}

	return c.JSON(fiber.Map{
		"data": notifications,
		"meta": fiber.Map{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func (h *NotificationHandler) UnreadCount(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	count, err := h.svc.UnreadCount(c.UserContext(), userID)
	if err != nil {
		log.Printf("notification handler: unread count error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal memuat jumlah notifikasi"})
	}

	return c.JSON(fiber.Map{"unread_count": count})
}

func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID notifikasi tidak valid"})
	}

	if err := h.svc.MarkRead(c.UserContext(), uint(id), userID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notifikasi tidak ditemukan"})
	}

	return c.JSON(fiber.Map{"message": "Notifikasi ditandai sudah dibaca"})
}

func (h *NotificationHandler) MarkAllRead(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	if err := h.svc.MarkAllRead(c.UserContext(), userID); err != nil {
		log.Printf("notification handler: mark all read error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Gagal menandai semua notifikasi"})
	}

	return c.JSON(fiber.Map{"message": "Semua notifikasi ditandai sudah dibaca"})
}
