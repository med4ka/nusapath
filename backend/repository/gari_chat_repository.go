package repository

import (
	"context"
	"time"

	"gorm.io/gorm"

	"smart-tourism/models"
)

// GariChatRepository — access to gari_chat_logs table (Gari rate limit).
// Only layer that touches gorm here; service calls through this interface
// (DI manual pattern same as other repositories).
type GariChatRepository struct {
	db *gorm.DB
}

func NewGariChatRepository(db *gorm.DB) *GariChatRepository {
	return &GariChatRepository{db: db}
}

// CountSince — number of chat attempts by user from created_at >= since
// (in this case = 00:00 WIB today). Basis for rate limit calculation.
func (r *GariChatRepository) CountSince(ctx context.Context, userID uint, since time.Time) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.GariChatLog{}).
		Where("user_id = ? AND created_at >= ?", userID, since).
		Count(&count).Error
	return count, err
}

// Create — record one chat attempt (regardless of Gemini result). Called
// AFTER rate limit (count) passes and BEFORE the request to Gemini, so
// failed attempts still consume the daily quota.
func (r *GariChatRepository) Create(ctx context.Context, userID uint, message string) error {
	return r.db.WithContext(ctx).
		Create(&models.GariChatLog{UserID: userID, Message: message}).Error
}