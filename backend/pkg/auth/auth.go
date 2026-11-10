package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmptySecret      = errors.New("auth: jwt secret kosong")
	ErrPasswordMismatch = errors.New("auth: password tidak cocok")
	ErrInvalidToken     = errors.New("auth: token tidak valid")
	ErrExpiredToken     = errors.New("auth: token sudah kedaluwarsa")
)

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword returns ErrPasswordMismatch for wrong password,
// or other error if hash in DB is corrupted — this distinction is important
// for structured logging (corrupted hash = internal data issue, not just
// wrong login).
func VerifyPassword(hash, password string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return ErrPasswordMismatch
	}
	return err
}

type Claims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// IssueToken carries role into the token. Consequence: role changes in DB
// only take effect after user re-login — accepted tradeoff so middleware
// does not need to query DB per request.
func IssueToken(userID uint, role, secret string, ttl time.Duration) (string, error) {
	if secret == "" {
		return "", ErrEmptySecret
	}

	now := time.Now()
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatUint(uint64(userID), 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func ParseToken(tokenString, secret string) (*Claims, error) {
	if secret == "" {
		return nil, ErrEmptySecret
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}
	if !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
