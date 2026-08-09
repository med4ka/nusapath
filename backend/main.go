package main

import (
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"smart-tourism/handlers"
	"smart-tourism/middleware"
	"smart-tourism/models"
	"smart-tourism/pkg/payment"
	"smart-tourism/repository"
	"smart-tourism/service"
)

func main() {
	if err := godotenv.Load(); err != nil {
		if exe, exeErr := os.Executable(); exeErr == nil {
			exeDir := filepath.Dir(exe)
			if dirErr := godotenv.Load(filepath.Join(exeDir, ".env")); dirErr != nil {
				log.Println("Peringatan: File .env tidak ditemukan")
			}
		} else {
			log.Println("Peringatan: File .env tidak ditemukan")
		}
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL wajib diisi di .env")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET wajib diisi di .env minimal 32 karakter — tidak boleh default lemah")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{TranslateError: true})
	if err != nil {
		log.Fatal("Gagal konek ke Database:", err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(time.Hour * 1)
	}
	log.Println("Berhasil konek ke Database dengan Connection Pooling!")

	db.AutoMigrate(
		&models.User{},
		&models.Destination{},
		&models.DestinationImage{},
		&models.Transaction{},
		&models.Facility{},
		&models.Wishlist{},
		&models.Review{},
		&models.GariChatLog{},
		&models.TransportRoute{},
		&models.Hotel{},
		&models.PromoCode{},
		&models.PromoCodeUsage{},
		&models.Notification{},
	)

	userRepo := repository.NewUserRepository(db)
	destinationRepo := repository.NewDestinationRepository(db)
	bookingRepo := repository.NewBookingRepository(db)
	facilityRepo := repository.NewFacilityRepository(db)
	wishlistRepo := repository.NewWishlistRepository(db)
	reviewRepo := repository.NewReviewRepository(db)
	gariLogRepo := repository.NewGariChatRepository(db)
	transportRepo := repository.NewTransportRouteRepository(db)
	hotelRepo := repository.NewHotelRepository(db)
	promoRepo := repository.NewPromoRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	handlers.DB = db
	handlers.FacilityRepo = facilityRepo

	authService := service.NewAuthService(userRepo, jwtSecret, 24*time.Hour)
	notificationService := service.NewNotificationService(notificationRepo)
	bookingService := service.NewBookingService(bookingRepo, destinationRepo, transportRepo, hotelRepo, promoRepo, notificationService, payment.NewSimulatedProvider())
	destinationService := service.NewDestinationService(destinationRepo)
	adminService := service.NewAdminService(destinationRepo, bookingRepo)
	transportService := service.NewTransportService(transportRepo, bookingRepo)
	hotelService := service.NewHotelService(hotelRepo, bookingRepo)
	aiService := service.NewAIService()
	wishlistService := service.NewWishlistService(wishlistRepo, destinationRepo)
	reviewService := service.NewReviewService(reviewRepo, destinationRepo)
	gariChatService := service.NewGariChatService(gariLogRepo, destinationRepo)
	promoService := service.NewPromoService(promoRepo, bookingRepo)
	notificationHandler := handlers.NewNotificationHandler(notificationService)

	authHandler := handlers.NewAuthHandler(authService)
	bookingHandler := handlers.NewBookingHandler(bookingService)
	destinationHandler := handlers.NewDestinationHandler(destinationService)
	adminHandler := handlers.NewAdminHandler(adminService)
	transportHandler := handlers.NewTransportHandler(transportService)
	aiHandler := handlers.NewAIHandler(aiService)
	wishlistHandler := handlers.NewWishlistHandler(wishlistService)
	reviewHandler := handlers.NewReviewHandler(reviewService)
	gariChatHandler := handlers.NewGariChatHandler(gariChatService)
	hotelHandler := handlers.NewHotelHandler(hotelService)
	promoHandler := handlers.NewPromoHandler(promoService)

	app := fiber.New(fiber.Config{
		ServerHeader: "SmartTourism-Engine",
		AppName:      "Smart Tourism API v1",
	})

	app.Use(cors.New())
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${ip} | ${status} | ${latency} | ${method} ${path}\n",
	}))
	// Route-specific limiters (auth, promo) are ADDITIONAL and stricter,
	// applied before the handler so the tighter limit is hit first.
	app.Use(limiter.New(limiter.Config{
		Max:        20,
		Expiration: 1 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{"error": "Terlalu banyak request!"})
		},
	}))

	authLimiter := limiter.New(limiter.Config{
		Max:        5,
		Expiration: 1 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{"error": "Terlalu banyak percobaan login/register. Coba lagi nanti."})
		},
	})
	promoLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{"error": "Terlalu banyak validasi kode promo. Coba lagi nanti."})
		},
	})

	api := app.Group("/api")
	// AuthOptional: valid cookie → is_wishlisted populated in list/detail;
	// no cookie/anonymous → still allowed access (public endpoint).
	api.Get("/destinations", middleware.AuthOptional(jwtSecret), destinationHandler.List)
	// Trending MUST be registered BEFORE /destinations/:id — otherwise,
	// "trending" could be treated as :id value. Fiber prioritizes static
	// segments over params, but this order is safe & explicit.
	api.Get("/destinations/trending", middleware.AuthOptional(jwtSecret), destinationHandler.Trending)
	api.Get("/destinations/:id", middleware.AuthOptional(jwtSecret), destinationHandler.Get)
	api.Get("/destinations/:id/reviews", reviewHandler.List)
	api.Get("/facilities", handlers.GetFacilities)
	api.Post("/smart-trip", middleware.AuthOptional(jwtSecret), aiHandler.GenerateItinerary)
	// Seed endpoints — admin only (operational, not public API).
	api.Get("/seed", middleware.Auth(jwtSecret), middleware.RequireRole(models.RoleAdmin), handlers.SeedDestinations)
	api.Get("/seed-hotels", middleware.Auth(jwtSecret), middleware.RequireRole(models.RoleAdmin), handlers.SeedHotels)
	api.Get("/seed-transport", middleware.Auth(jwtSecret), middleware.RequireRole(models.RoleAdmin), handlers.SeedTransport)
	api.Get("/hotels", hotelHandler.List)
	// Hotel cities MUST be registered BEFORE /hotels/:id (same pattern as
	// /destinations/trending and /transport-routes/cities).
	api.Get("/hotels/cities", hotelHandler.Cities)
	api.Get("/hotels/:id", hotelHandler.Get)

	// Transport ticketing — PUBLIC endpoints (no auth): list, detail, cities.
	// Required: /transport-routes/cities REGISTERED BEFORE /:id so "cities"
	// is not treated as :id value (same pattern as /destinations/trending).
	api.Get("/transport-routes", transportHandler.List)
	api.Get("/transport-routes/cities", transportHandler.Cities)
	api.Get("/transport-routes/:id", transportHandler.Get)

	authRoutes := api.Group("/auth", authLimiter)
	authRoutes.Post("/register", authHandler.Register)
	authRoutes.Post("/login", authHandler.Login)
	authRoutes.Post("/logout", authHandler.Logout)
	authRoutes.Get("/me", middleware.Auth(jwtSecret), authHandler.Me)

	api.Post("/booking", middleware.Auth(jwtSecret), bookingHandler.CreateBooking)
	api.Post("/booking/:id/confirm-payment", middleware.Auth(jwtSecret), bookingHandler.ConfirmPayment)
	api.Post("/booking/:id/cancel", middleware.Auth(jwtSecret), bookingHandler.Cancel)
	api.Get("/bookings/me", middleware.Auth(jwtSecret), bookingHandler.MyBookings)

	// Ticket verification — PUBLIC (no auth). Only returns initials, no email/contact.
	api.Get("/tickets/verify/:hash", bookingHandler.VerifyTicket)

	// Wishlist — auth REQUIRED (toggle without login = 401). user_id taken
	// by middleware from cookie, not from body.
	api.Post("/wishlist/:destinationId", middleware.Auth(jwtSecret), wishlistHandler.Toggle)
	api.Get("/wishlist/me", middleware.Auth(jwtSecret), wishlistHandler.ListMe)

	// Review — POST auth REQUIRED + booking TICKET_ISSUED requirement; GET public.
	api.Post("/destinations/:id/reviews", middleware.Auth(jwtSecret), reviewHandler.Create)

	// Gari chat — auth REQUIRED, rate limit per user per day (WIB) in service.
	api.Post("/gari/chat", middleware.Auth(jwtSecret), gariChatHandler.Chat)

	// Promo code — auth REQUIRED; rate limited to prevent brute-force guessing.
	api.Post("/promo/validate", middleware.Auth(jwtSecret), promoLimiter, promoHandler.Validate)

	notif := api.Group("/notifications", middleware.Auth(jwtSecret))
	notif.Get("/me", notificationHandler.List)
	notif.Get("/unread-count", notificationHandler.UnreadCount)
	notif.Post("/:id/read", notificationHandler.MarkRead)
	notif.Post("/read-all", notificationHandler.MarkAllRead)

	adminPromo := api.Group("/admin/promo", middleware.Auth(jwtSecret), middleware.RequireRole(models.RoleAdmin))
	adminPromo.Post("/", promoHandler.Create)
	adminPromo.Put("/:id", promoHandler.Update)
	adminPromo.Delete("/:id", promoHandler.Delete)
	adminPromo.Get("/", promoHandler.List)
	adminPromo.Get("/:id", promoHandler.Get)

	// All admin routes MUST go through Auth first (401 without cookie), then
	// RequireRole (403 if role not admin). Role taken from JWT claims already
	// set by Auth on context — no additional DB queries.
	admin := api.Group("/admin", middleware.Auth(jwtSecret), middleware.RequireRole(models.RoleAdmin))
	admin.Post("/destinations", adminHandler.CreateDestination)
	admin.Put("/destinations/:id", adminHandler.UpdateDestination)
	admin.Delete("/destinations/:id", adminHandler.DeleteDestination)
	admin.Post("/destinations/:id/images", adminHandler.AddImage)
	admin.Delete("/destinations/:id/images/:imageId", adminHandler.RemoveImage)
	admin.Post("/transport-routes", transportHandler.Create)
	admin.Put("/transport-routes/:id", transportHandler.Update)
	admin.Delete("/transport-routes/:id", transportHandler.Delete)
	admin.Post("/hotels", hotelHandler.Create)
	admin.Put("/hotels/:id", hotelHandler.Update)
	admin.Delete("/hotels/:id", hotelHandler.Delete)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Memulai server HTTP di :%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("Gagal menjalankan server:", err)
	}
}
