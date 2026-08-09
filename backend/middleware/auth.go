package middleware

import (
	"github.com/gofiber/fiber/v2"

	"smart-tourism/pkg/auth"
)

const (
	SessionCookieName = "nusapath_session"
	UserIDKey         = "user_id"
	RoleKey           = "role"
)

// Auth reads JWT from httpOnly cookie (not Authorization header),
// validates, then sets user_id + role to context. 401 if cookie missing /
// invalid / expired. Handler reads user_id from context, not from body.
func Auth(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies(SessionCookieName)
		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Tidak terautentikasi"})
		}

		claims, err := auth.ParseToken(token, jwtSecret)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid atau kedaluwarsa"})
		}

		c.Locals(UserIDKey, claims.UserID)
		c.Locals(RoleKey, claims.Role)
		return c.Next()
	}
}

// RequireRole rejects request if role in context (already set by Auth
// from JWT claims — does NOT re-query DB) is not the requested role.
// Must be mounted AFTER Auth in middleware chain: Auth(...), RequireRole("admin").
func RequireRole(role string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		current, ok := c.Locals(RoleKey).(string)
		if !ok || current != role {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Akses ditolak"})
		}
		return c.Next()
	}
}

// AuthOptional reads cookie if PRESENT, and if valid sets user_id (+role)
// to context — but NEVER rejects request if cookie missing /
// invalid / expired. Mounted on public endpoints that need optional user
// context (e.g. is_wishlisted in GET /api/destinations, Batch 2). Handler
// reads user_id from context; if absent (anonymous), userID = 0.
func AuthOptional(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies(SessionCookieName)
		if token == "" {
			return c.Next()
		}
		if claims, err := auth.ParseToken(token, jwtSecret); err == nil {
			c.Locals(UserIDKey, claims.UserID)
			c.Locals(RoleKey, claims.Role)
		}
		return c.Next()
	}
}
