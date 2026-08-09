package repository

import (
	"context"

	"gorm.io/gorm"

	"smart-tourism/models"
)

type FacilityRepository struct {
	db *gorm.DB
}

func NewFacilityRepository(db *gorm.DB) *FacilityRepository {
	return &FacilityRepository{db: db}
}

func (r *FacilityRepository) FindAll(ctx context.Context) ([]models.Facility, error) {
	var facilities []models.Facility
	err := r.db.WithContext(ctx).Find(&facilities).Error
	if err != nil {
		return nil, err
	}
	return facilities, nil
}
