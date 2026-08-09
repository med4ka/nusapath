package handlers

import (
	"errors"
	"fmt"
	"smart-tourism/models"
	"smart-tourism/repository"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

var (
	DB           *gorm.DB
	FacilityRepo *repository.FacilityRepository
)

func GetFacilities(c *fiber.Ctx) error {
	facilities, err := FacilityRepo.FindAll(c.UserContext())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal narik data fasilitas"})
	}
	return c.JSON(facilities)
}

func SeedDestinations(c *fiber.Ctx) error {
	destinations := []models.Destination{
		{Name: "Candi Borobudur (Sunrise Ticket)", Category: "Sejarah", Price: 350000, Rating: 4.9, ImageURL: "/borobur.png", Description: "Matahari terbit di candi terbesar dunia."},
		{Name: "Uluwatu Kecak Fire Dance", Category: "Budaya", Price: 150000, Rating: 4.8, ImageURL: "/kecak_dance.png", Description: "Tarian magis di tebing Uluwatu."},
		{Name: "Paket Snorkeling Raja Ampat", Category: "Bahari", Price: 1200000, Rating: 5.0, ImageURL: "/snorkeling_raja.png", Description: "Surga bawah laut Papua."},
		{Name: "Jeep Tour Bromo Tengger", Category: "Alam", Price: 600000, Rating: 4.7, ImageURL: "/sewa_jeep.png", Description: "Petualangan jeep Bromo."},
		{Name: "Nusa Penida", Category: "Bahari", Price: 750000, Rating: 4.8, ImageURL: "/nusa-penida.png", Description: "Surga tropis dengan tebing dramatis, pasir putih, dan spot snorkeling kelas dunia.\n\nTerletak di sebelah tenggara Bali, Nusa Penida menawarkan pesona alam yang masih asri dan dramatis. Pulau ini terkenal dengan formasi tebing karang ikonik seperti Kelingking Beach, lengkungan tebing Broken Beach, hingga perairan kristal di Crystal Bay yang menjadi rumah bagi ikan pari Manta. Destinasi yang wajib dikunjungi bagi para petualang dan pencinta pantai eksotis."},
		{Name: "Mandalika", Category: "Alam", Price: 500000, Rating: 4.7, ImageURL: "/mandalika.png", Description: "Paduan sempurna antara sirkuit balap internasional dan keindahan pantai selatan Lombok.\n\nMandalika adalah Kawasan Ekonomi Khusus di Lombok Tengah yang menghadirkan pengalaman wisata ganda. Nikmati kemegahan Pertamina Mandalika International Street Circuit yang berbatasan langsung dengan deretan pantai berpasir merica seperti Pantai Kuta Mandalika dan Tanjung Aan. Selain olahraga otomotif, kawasan ini juga kaya akan kearifan lokal desa adat Sasak yang memikat."},
		{Name: "Pulau Komodo", Category: "Bahari", Price: 1500000, Rating: 5.0, ImageURL: "/pulau-komodo.png", Description: "Jelajahi habitat asli kadal raksasa prasejarah dan panorama kepulauan yang menakjubkan.\n\nMenjadi bagian dari Taman Nasional Komodo, pulau ini memberikan pengalaman langka melihat langsung Komodo, spesies kadal terbesar di dunia, di alam liarnya. Selain satwa endemik, pesona daratannya dipadukan dengan keindahan Pink Beach yang unik dan titik-titik penyelaman dengan keanekaragaman hayati laut terbaik di Indonesia."},
		{Name: "Danau Toba", Category: "Alam", Price: 450000, Rating: 4.9, ImageURL: "/danau-toba.png", Description: "Danau vulkanik terbesar di dunia dengan kekayaan budaya Batak di Pulau Samosir.\n\nDanau Toba bukan sekadar danau biasa, melainkan keajaiban alam berupa kaldera gunung berapi purba yang sangat luas. Di tengahnya terdapat Pulau Samosir yang menjadi pusat kebudayaan Batak Toba. Pengunjung dapat menikmati udara sejuk pegunungan, mengunjungi desa-desa tradisional dengan rumah adat yang khas, serta mempelajari sejarah dan kain ulos yang kaya makna."},
		{Name: "Labuan Bajo", Category: "Bahari", Price: 1200000, Rating: 4.8, ImageURL: "/labuan-bajo-flores-indonesia.png", Description: "Kota pelabuhan eksotis yang menjadi pintu gerbang utama menuju keajaiban Flores.\n\nTerletak di ujung barat Pulau Flores, Labuan Bajo adalah titik mula untuk petualangan island hopping menggunakan kapal pinisi. Kota pelabuhan ini menawarkan pemandangan siluet perbukitan dan lautan yang dipenuhi kapal-kapal wisata. Jangan lewatkan pemandangan sunset terbaik dari Bukit Sylvia dan berbagai kuliner seafood segar di pinggir pantai."},
	}

	// 1) Clean old placeholders (price 0) from previous seed.
	if err := DB.Where("price = ?", 0).Delete(&models.Destination{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal bersihkan data destinasi lama"})
	}

	// 2) Dedupe remaining duplicates from old seed: keep smallest id per name.
	if err := DB.Exec(
		"DELETE FROM destinations d WHERE d.id NOT IN (SELECT MIN(id) FROM destinations GROUP BY name)",
	).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Gagal bersihkan data destinasi dobel"})
	}

	// 3) Upsert by name — idempotent seed, safe to call multiple times.
	for _, d := range destinations {
		var existing models.Destination
		err := DB.Where("name = ?", d.Name).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if cerr := DB.Create(&d).Error; cerr != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan destinasi: " + cerr.Error()})
			}
			continue
		}
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal cek destinasi: " + err.Error()})
		}
		if uerr := DB.Model(&existing).Updates(map[string]interface{}{
			"category":    d.Category,
			"price":       d.Price,
			"rating":      d.Rating,
			"image_url":   d.ImageURL,
			"description": d.Description,
		}).Error; uerr != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal update destinasi: " + uerr.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("BAM! Seed idempotent selesai — %d destinasi siap.", len(destinations)),
	})
}

func SeedHotels(c *fiber.Ctx) error {
	hotels := []models.Hotel{
		{Name: "Grand Ekspedisi Hotel Yogyakarta", City: "Yogyakarta", PricePerNight: 850000, StarRating: 4, Description: "Hotel bersejarah di pusat Kota Gudeg, dekat Malioboro dan Keraton.", ImageURL: "", Amenities: "WiFi, Kolam Renang, Sarapan, Parkir, AC"},
		{Name: "The Nusa Dua Beach Resort", City: "Bali", PricePerNight: 2500000, StarRating: 5, Description: "Resor tepi pantai di kawasan Nusa Dua dengan pemandangan Samudra Hindia.", ImageURL: "", Amenities: "WiFi, Kolam Renang, Spa, Sarapan, Restoran, Pantai Pribadi"},
		{Name: "Bromo Mountain Retreat", City: "Malang", PricePerNight: 650000, StarRating: 3, Description: "Penginapan nyaman di lereng Bromo, cocok untuk para pendaki dan pemburu sunrise.", ImageURL: "", Amenities: "WiFi, Sarapan, Parkir, AC, Air Panas"},
		{Name: "Labuan Bajo Marina Hotel", City: "Labuan Bajo", PricePerNight: 1200000, StarRating: 4, Description: "Hotel tepi pelabuhan dengan akses mudah ke kapal pinisi menuju Pulau Komodo.", ImageURL: "", Amenities: "WiFi, Kolam Renang, Sarapan, Restoran, AC"},
		{Name: "Samosir Highland Resort", City: "Medan", PricePerNight: 550000, StarRating: 4, Description: "Resor di tepi Danau Toba dengan panorama kaldera vulkanik dan budaya Batak.", ImageURL: "", Amenities: "WiFi, Sarapan, Parkir, AC, Pemandu Wisata"},
		{Name: "Raja Ampat Eco Lodge", City: "Raja Ampat", PricePerNight: 1800000, StarRating: 3, Description: "Eco-lodge ramah lingkungan di tengah gugusan pulau Raja Ampat, surga snorkeling.", ImageURL: "", Amenities: "WiFi, Sarapan, Snorkeling, Diving, Restoran"},
		{Name: "Mandalika Circuit Inn", City: "Lombok", PricePerNight: 750000, StarRating: 4, Description: "Hotel modern dekat Sirkuit Mandalika, cocok untuk penonton MotoGP dan wisatawan.", ImageURL: "", Amenities: "WiFi, Kolam Renang, Sarapan, Parkir, AC, Gym"},
		{Name: "Taman Sari Heritage Hotel", City: "Yogyakarta", PricePerNight: 450000, StarRating: 3, Description: "Hotel budget dengan nuansa klasik Jawa di kawasan Taman Sari.", ImageURL: "", Amenities: "WiFi, Sarapan, AC, Parkir"},
	}

	for _, h := range hotels {
		var existing models.Hotel
		err := DB.Where("name = ?", h.Name).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if cerr := DB.Create(&h).Error; cerr != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan hotel: " + cerr.Error()})
			}
			continue
		}
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal cek hotel: " + err.Error()})
		}
		if uerr := DB.Model(&existing).Updates(map[string]interface{}{
			"city":            h.City,
			"price_per_night": h.PricePerNight,
			"star_rating":     h.StarRating,
			"description":     h.Description,
			"image_url":       h.ImageURL,
			"amenities":       h.Amenities,
		}).Error; uerr != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal update hotel: " + uerr.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("BAM! Seed idempotent selesai — %d hotel siap.", len(hotels)),
	})
}

func SeedTransport(c *fiber.Ctx) error {
	now := time.Now()
	routes := []struct {
		Type          string
		OperatorName  string
		OriginCity    string
		DestCity      string
		DepartureTime time.Time
		ArrivalTime   time.Time
		Price         int64
		SeatClass     string
		TotalSeats    int
		AvailableSeats int
	}{
		{Type: "flight", OperatorName: "Garuda Indonesia", OriginCity: "Jakarta", DestCity: "Yogyakarta", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 6, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 7, 15, 0, 0, time.Local), Price: 850000, SeatClass: "Ekonomi", TotalSeats: 180, AvailableSeats: 120},
		{Type: "flight", OperatorName: "Batik Air", OriginCity: "Jakarta", DestCity: "Bali", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 8, 30, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 11, 45, 0, 0, time.Local), Price: 1200000, SeatClass: "Ekonomi", TotalSeats: 200, AvailableSeats: 150},
		{Type: "flight", OperatorName: "Lion Air", OriginCity: "Surabaya", DestCity: "Labuan Bajo", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+2, 10, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+2, 13, 0, 0, 0, time.Local), Price: 980000, SeatClass: "Ekonomi", TotalSeats: 160, AvailableSeats: 90},
		{Type: "flight", OperatorName: "Garuda Indonesia", OriginCity: "Bali", DestCity: "Lombok", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 14, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 14, 45, 0, 0, time.Local), Price: 550000, SeatClass: "Ekonomi", TotalSeats: 120, AvailableSeats: 80},
		{Type: "train", OperatorName: "PT KAI (Argo Parahyangan)", OriginCity: "Jakarta", DestCity: "Bandung", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 7, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 9, 30, 0, 0, time.Local), Price: 250000, SeatClass: "Eksekutif", TotalSeats: 300, AvailableSeats: 200},
		{Type: "train", OperatorName: "PT KAI (Taksaka)", OriginCity: "Jakarta", DestCity: "Yogyakarta", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 20, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+2, 5, 30, 0, 0, time.Local), Price: 350000, SeatClass: "Eksekutif", TotalSeats: 250, AvailableSeats: 180},
		{Type: "train", OperatorName: "PT KAI (Mutiara Selatan)", OriginCity: "Surabaya", DestCity: "Yogyakarta", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 8, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 13, 0, 0, 0, time.Local), Price: 200000, SeatClass: "Bisnis", TotalSeats: 280, AvailableSeats: 190},
		{Type: "bus", OperatorName: "Damri", OriginCity: "Bandung", DestCity: "Jakarta", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 6, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 11, 0, 0, 0, time.Local), Price: 150000, SeatClass: "AC Eksekutif", TotalSeats: 40, AvailableSeats: 35},
		{Type: "bus", OperatorName: "Sinar Jaya", OriginCity: "Jakarta", DestCity: "Yogyakarta", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 21, 0, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+2, 8, 0, 0, 0, time.Local), Price: 180000, SeatClass: "AC Super Executive", TotalSeats: 35, AvailableSeats: 30},
		{Type: "bus", OperatorName: "ALS", OriginCity: "Yogyakarta", DestCity: "Surabaya", DepartureTime: time.Date(now.Year(), now.Month(), now.Day()+1, 7, 30, 0, 0, time.Local), ArrivalTime: time.Date(now.Year(), now.Month(), now.Day()+1, 14, 0, 0, 0, time.Local), Price: 120000, SeatClass: "AC", TotalSeats: 45, AvailableSeats: 42},
	}

	for _, r := range routes {
		route := models.TransportRoute{
			Type:           r.Type,
			OperatorName:   r.OperatorName,
			OriginCity:     r.OriginCity,
			DestCity:       r.DestCity,
			DepartureTime:  r.DepartureTime,
			ArrivalTime:    r.ArrivalTime,
			Price:          r.Price,
			SeatClass:      r.SeatClass,
			TotalSeats:     r.TotalSeats,
			AvailableSeats: r.AvailableSeats,
		}
		var existing models.TransportRoute
		err := DB.Where("operator_name = ? AND origin_city = ? AND dest_city = ? AND departure_time = ?",
			route.OperatorName, route.OriginCity, route.DestCity, route.DepartureTime).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if cerr := DB.Create(&route).Error; cerr != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Gagal menyimpan rute transport: " + cerr.Error()})
			}
			continue
		}
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Gagal cek rute transport: " + err.Error()})
		}
	}

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("BAM! Seed idempotent selesai — %d rute transport siap.", len(routes)),
	})
}
