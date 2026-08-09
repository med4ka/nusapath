package handlers

import (
	"errors"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"

	"smart-tourism/middleware"
	"smart-tourism/models"
	"smart-tourism/service"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func sessionCookieSecure() bool {
	return os.Getenv("APP_ENV") == "production"
}

func setSessionCookie(c *fiber.Ctx, token string) {
	c.Cookie(&fiber.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    token,
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   sessionCookieSecure(),
		MaxAge:   int((24 * time.Hour).Seconds()),
	})
}

func clearSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     middleware.SessionCookieName,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   sessionCookieSecure(),
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
	})
}

func userResponse(user models.User) fiber.Map {
	return fiber.Map{"id": user.ID, "name": user.Name, "email": user.Email, "role": user.Role}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req service.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	user, token, err := h.svc.Register(c.UserContext(), req)
	if err != nil {
		return mapAuthError(c, err)
	}

	setSessionCookie(c, token)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"user": userResponse(user)})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req service.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Format request salah"})
	}

	user, token, err := h.svc.Login(c.UserContext(), req)
	if err != nil {
		return mapAuthError(c, err)
	}

	setSessionCookie(c, token)
	return c.JSON(fiber.Map{"user": userResponse(user)})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// httpOnly cookie cannot be deleted from JS — logout MUST use this endpoint
	clearSessionCookie(c)
	return c.JSON(fiber.Map{"message": "Logout berhasil"})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID, ok := c.Locals(middleware.UserIDKey).(uint)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
	}

	user, err := h.svc.Me(c.UserContext(), userID)
	if err != nil {
		return mapAuthError(c, err)
	}

	return c.JSON(fiber.Map{"user": userResponse(user)})
}

func mapAuthError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	case errors.Is(err, service.ErrEmailExists):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email sudah terdaftar"})
	case errors.Is(err, service.ErrInvalidCredentials):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Email atau password salah"})
	case errors.Is(err, service.ErrInvalidSession):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid"})
	default:
		log.Printf("auth handler: error internal: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan internal"})
	}
}
