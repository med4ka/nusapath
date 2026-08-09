package repository

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type PromoRepository struct {
	db *gorm.DB
}

func NewPromoRepository(db *gorm.DB) *PromoRepository {
	return &PromoRepository{db: db}
}

func (r *PromoRepository) FindByCode(ctx context.Context, code string) (*models.PromoCode, error) {
	var promo models.PromoCode
	err := r.db.WithContext(ctx).Where("code = ? AND is_active = ?", code, true).First(&promo).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &promo, nil
}

func (r *PromoRepository) FindByID(ctx context.Context, id uint) (*models.PromoCode, error) {
	var promo models.PromoCode
	err := r.db.WithContext(ctx).First(&promo, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &promo, nil
}

func (r *PromoRepository) HasUsageByUser(ctx context.Context, promoID, userID uint) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.PromoCodeUsage{}).
		Where("promo_code_id = ? AND user_id = ?", promoID, userID).
		Count(&count).Error
	return count > 0, err
}

func (r *PromoRepository) IncrementUsageCount(ctx context.Context, promoID uint) error {
	return r.db.WithContext(ctx).Model(&models.PromoCode{}).
		Where("id = ?", promoID).
		Update("usage_count", gorm.Expr("usage_count + 1")).Error
}

// CreateUsage — insert usage row + increment usage_count atomically in 1 transaction.
// Return error if usage count already >= usage_limit (race: parallel requests).
// If promo.per_user_limit is true, insert usage row (unique constraint (promo_id, user_id)
// prevents reuse by the same user). If false, skip insert — just increment count.
func (r *PromoRepository) CreateUsage(ctx context.Context, promoID, userID, transactionID uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var promo models.PromoCode
		if err := tx.WithContext(ctx).First(&promo, promoID).Error; err != nil {
			return err
		}

		if promo.UsageLimit != nil && promo.UsageCount >= *promo.UsageLimit {
			return ErrPromoUsageLimitExhausted
		}

		if err := tx.Model(&models.PromoCode{}).
			Where("id = ?", promoID).
			Update("usage_count", gorm.Expr("usage_count + 1")).Error; err != nil {
			return err
		}

		if promo.PerUserLimit != nil && *promo.PerUserLimit {
			usage := models.PromoCodeUsage{
				PromoCodeID:   promoID,
				UserID:        userID,
				TransactionID: transactionID,
			}
			if err := tx.Create(&usage).Error; err != nil {
				if errors.Is(err, gorm.ErrDuplicatedKey) {
					return ErrPromoAlreadyUsedByUser
				}
				return err
			}
		}
		return nil
	})
}

// ListAll — all promos (including inactive) for admin.
func (r *PromoRepository) ListAll(ctx context.Context) ([]models.PromoCode, error) {
	var promos []models.PromoCode
	err := r.db.WithContext(ctx).Order("created_at DESC").Find(&promos).Error
	return promos, err
}

// ListUsageByPromoID — usage details for admin (who used it).
func (r *PromoRepository) ListUsageByPromoID(ctx context.Context, promoID uint) ([]models.PromoCodeUsage, error) {
	var usages []models.PromoCodeUsage
	err := r.db.WithContext(ctx).
		Where("promo_code_id = ?", promoID).
		Preload("User").
		Order("created_at DESC").
		Find(&usages).Error
	return usages, err
}

func (r *PromoRepository) Create(ctx context.Context, promo *models.PromoCode) error {
	return r.db.WithContext(ctx).Create(promo).Error
}

func (r *PromoRepository) Update(ctx context.Context, promo *models.PromoCode) error {
	return r.db.WithContext(ctx).Save(promo).Error
}

func (r *PromoRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&models.PromoCode{}, id).Error
}

func (r *PromoRepository) IsExpired(ctx context.Context, promo *models.PromoCode) bool {
	now := time.Now()
	return now.Before(promo.ValidFrom) || now.After(promo.ValidUntil)
}

var ErrPromoUsageLimitExhausted = errors.New("usage limit promo sudah habis")
var ErrPromoAlreadyUsedByUser = errors.New("kode promo sudah pernah dipakai oleh user ini")
