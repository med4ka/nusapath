package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type TransportRouteRepository struct {
	db *gorm.DB
}

func NewTransportRouteRepository(db *gorm.DB) *TransportRouteRepository {
	return &TransportRouteRepository{db: db}
}

// FindByID — lookup 1 route (soft-deleted automatically not found, default
// gorm scope). Used by booking (server-side price lookup) & public detail.
func (r *TransportRouteRepository) FindByID(ctx context.Context, id uint) (*models.TransportRoute, error) {
	var route models.TransportRoute
	err := r.db.WithContext(ctx).First(&route, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &route, nil
}

// FindByIDUnscoped — lookup route WITHOUT soft-delete scope. Used when
// building ticket payload in confirm-payment: routes that were soft-deleted
// after booking creation must still be included (complete ticket archive).
func (r *TransportRouteRepository) FindByIDUnscoped(ctx context.Context, id uint) (*models.TransportRoute, error) {
	var route models.TransportRoute
	err := r.db.WithContext(ctx).Unscoped().First(&route, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &route, nil
}

type TransportRouteFilter struct {
	Type       string
	OriginCity string
	DestCity   string
	// Date — departure date (format YYYY-MM-DD), compared against
	// departure_time column (ignoring time).
	Date string
}

func applyTransportRouteFilter(db *gorm.DB, f TransportRouteFilter) *gorm.DB {
	q := db
	if f.Type != "" {
		q = q.Where("type = ?", f.Type)
	}
	if f.OriginCity != "" {
		q = q.Where("origin_city ILIKE ?", "%"+f.OriginCity+"%")
	}
	if f.DestCity != "" {
		q = q.Where("dest_city ILIKE ?", "%"+f.DestCity+"%")
	}
	if f.Date != "" {
		q = q.Where("DATE(departure_time) = ?", f.Date)
	}
	return q
}

// List — schedule routes, sorted by earliest departure first. Page/Limit
// 0 = full array (dual mode same as GET /api/destinations).
func (r *TransportRouteRepository) List(ctx context.Context, f TransportRouteFilter, page, limit int) ([]models.TransportRoute, error) {
	var routes []models.TransportRoute
	q := applyTransportRouteFilter(r.db.WithContext(ctx).Model(&models.TransportRoute{}), f)
	q = q.Order("departure_time ASC, id ASC")
	if limit > 0 {
		q = q.Limit(limit).Offset((page - 1) * limit)
	}
	if err := q.Find(&routes).Error; err != nil {
		return nil, err
	}
	return routes, nil
}

func (r *TransportRouteRepository) Count(ctx context.Context, f TransportRouteFilter) (int64, error) {
	var total int64
	q := applyTransportRouteFilter(r.db.WithContext(ctx).Model(&models.TransportRoute{}), f)
	if err := q.Count(&total).Error; err != nil {
		return 0, err
	}
	return total, nil
}

// ListCities — unique city list (origin + dest merged) for frontend search
// dropdown. Soft-deleted routes not included.
func (r *TransportRouteRepository) ListCities(ctx context.Context) ([]string, error) {
	var origins []string
	if err := r.db.WithContext(ctx).
		Model(&models.TransportRoute{}).
		Distinct("origin_city").
		Where("origin_city <> ''").
		Pluck("origin_city", &origins).Error; err != nil {
		return nil, err
	}
	var dests []string
	if err := r.db.WithContext(ctx).
		Model(&models.TransportRoute{}).
		Distinct("dest_city").
		Where("dest_city <> ''").
		Pluck("dest_city", &dests).Error; err != nil {
		return nil, err
	}

	seen := make(map[string]struct{}, len(origins)+len(dests))
	out := make([]string, 0, len(origins)+len(dests))
	for _, list := range [][]string{origins, dests} {
		for _, city := range list {
			if _, ok := seen[city]; ok {
				continue
			}
			seen[city] = struct{}{}
			out = append(out, city)
		}
	}
	// Sort ascending so dropdown is consistent.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j] < out[j-1]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out, nil
}

// DeductAvailableSeats — atomic seat deduction: only succeeds when
// available_seats >= qty (WHERE evaluated in a single UPDATE). RowsAffected
// 0 means insufficient seats (or route gone) — another buyer got them first.
func (r *TransportRouteRepository) DeductAvailableSeats(ctx context.Context, id uint, qty int) (bool, error) {
	res := r.db.WithContext(ctx).
		Model(&models.TransportRoute{}).
		Where("id = ? AND available_seats >= ?", id, qty).
		Update("available_seats", gorm.Expr("available_seats - ?", qty))
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

func (r *TransportRouteRepository) Create(ctx context.Context, route *models.TransportRoute) error {
	return r.db.WithContext(ctx).Create(route).Error
}

func (r *TransportRouteRepository) Update(ctx context.Context, route *models.TransportRoute) error {
	return r.db.WithContext(ctx).Save(route).Error
}

// Delete = SOFT delete (set deleted_at). Used for routes with booking
// history — row must not disappear permanently (FK RESTRICT).
func (r *TransportRouteRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.TransportRoute{}, id).Error
}

// DeletePermanent = HARD delete (unscoped). Only called after confirming
// NO booking references this route.
func (r *TransportRouteRepository) DeletePermanent(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Unscoped().Delete(&models.TransportRoute{}, id).Error
}
