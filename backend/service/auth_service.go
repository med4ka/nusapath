package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"reflect"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"

	"smart-tourism/models"
	"smart-tourism/pkg/auth"
	"smart-tourism/repository"
)

var (
	ErrInvalidInput       = errors.New("input tidak valid")
	ErrEmailExists        = errors.New("email sudah terdaftar")
	ErrInvalidCredentials = errors.New("email atau password salah")
	ErrInvalidSession     = errors.New("sesi tidak valid")
)

type RegisterRequest struct {
	Name     string `json:"name" validate:"required,max=100"`
	Email    string `json:"email" validate:"required,email,max=150"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type AuthService struct {
	users     *repository.UserRepository
	jwtSecret string
	tokenTTL  time.Duration
	validate  *validator.Validate
}

func NewAuthService(users *repository.UserRepository, jwtSecret string, tokenTTL time.Duration) *AuthService {
	return &AuthService{
		users:     users,
		jwtSecret: jwtSecret,
		tokenTTL:  tokenTTL,
		validate:  validator.New(),
	}
}

func validationMessage(validationErrors validator.ValidationErrors) string {
	for _, e := range validationErrors {
		switch e.Tag() {
		case "required":
			return fmt.Sprintf("field %s wajib diisi", e.Field())
		case "email":
			return "format email tidak valid"
		case "min":
			if isIntegerKind(e) {
				return fmt.Sprintf("field %s minimal %s", e.Field(), e.Param())
			}
			return fmt.Sprintf("field %s minimal %s karakter", e.Field(), e.Param())
		case "max":
			if isIntegerKind(e) {
				return fmt.Sprintf("field %s maksimal %s", e.Field(), e.Param())
			}
			return fmt.Sprintf("field %s maksimal %s karakter", e.Field(), e.Param())
		case "gt":
			return fmt.Sprintf("field %s harus lebih dari 0", e.Field())
		case "gte":
			return fmt.Sprintf("field %s minimal %s", e.Field(), e.Param())
		case "lte":
			return fmt.Sprintf("field %s maksimal %s", e.Field(), e.Param())
		case "url":
			return "format URL tidak valid"
		case "oneof":
			return fmt.Sprintf("field %s harus salah satu dari: %s", e.Field(), e.Param())
		case "budget_enum":
			return "field budget harus salah satu dari: Hemat, Menengah, Mewah"
		case "style_enum":
			return "field style harus salah satu dari: Budaya & Sejarah, Alam & Petualangan, Kuliner & Santai"
		}
	}
	return "input tidak valid"
}

// isIntegerKind — whether the validator field is a numeric type (not string).
// Used so min/max messages for int (e.g. rating 1–5) do not use the word
// "karakter" which only makes sense for strings.
func isIntegerKind(e validator.FieldError) bool {
	switch e.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return true
	}
	return false
}

func (s *AuthService) Register(ctx context.Context, req RegisterRequest) (models.User, string, error) {
	if err := s.validate.Struct(req); err != nil {
		return models.User{}, "", fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	existing, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		return models.User{}, "", err
	}
	if existing != nil {
		return models.User{}, "", ErrEmailExists
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return models.User{}, "", err
	}

	user := models.User{
		Name:         strings.TrimSpace(req.Name),
		Email:        email,
		PasswordHash: hash,
		// Role is ALWAYS "user" — client can never choose their own role.
		// Admin promotion only via direct DB access.
		Role: models.RoleUser,
	}
	if err := s.users.Create(ctx, &user); err != nil {
		return models.User{}, "", err
	}

	token, err := auth.IssueToken(user.ID, user.Role, s.jwtSecret, s.tokenTTL)
	if err != nil {
		return models.User{}, "", err
	}
	return user, token, nil
}

func (s *AuthService) Login(ctx context.Context, req LoginRequest) (models.User, string, error) {
	if err := s.validate.Struct(req); err != nil {
		return models.User{}, "", fmt.Errorf("%w: %s", ErrInvalidInput, validationMessage(err.(validator.ValidationErrors)))
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := s.users.FindByEmail(ctx, email)
	if err != nil {
		return models.User{}, "", err
	}
	if user == nil {
		// response is IDENTICAL for email not found vs wrong password —
		// do not leak which one failed (SPEC §1.2)
		return models.User{}, "", ErrInvalidCredentials
	}

	if err := auth.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		if !errors.Is(err, auth.ErrPasswordMismatch) {
			log.Printf("auth: password hash korup untuk user %d: %v", user.ID, err)
		}
		return models.User{}, "", ErrInvalidCredentials
	}

	token, err := auth.IssueToken(user.ID, user.Role, s.jwtSecret, s.tokenTTL)
	if err != nil {
		return models.User{}, "", err
	}
	return *user, token, nil
}

func (s *AuthService) Me(ctx context.Context, userID uint) (models.User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return models.User{}, err
	}
	if user == nil {
		return models.User{}, ErrInvalidSession
	}
	return *user, nil
}
