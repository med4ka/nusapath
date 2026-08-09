package service

import (
	"context"
	"fmt"
	"time"

	"smart-tourism/models"
	"smart-tourism/repository"
)

type NotificationService struct {
	notifications *repository.NotificationRepository
}

func NewNotificationService(notifications *repository.NotificationRepository) *NotificationService {
	return &NotificationService{notifications: notifications}
}

const (
	NotifBookingCreated = "booking_created"
	NotifPaymentSuccess = "payment_success"
	NotifTicketIssued   = "ticket_issued"
	NotifPromoUsed      = "promo_used"
)

func (s *NotificationService) notify(ctx context.Context, userID uint, notifType, title, message string, txnID *uint) {
	n := &models.Notification{
		UserID:               userID,
		Type:                 notifType,
		Title:                title,
		Message:              message,
		IsRead:               false,
		RelatedTransactionID: txnID,
		CreatedAt:            time.Now(),
	}
	if err := s.notifications.Create(ctx, n); err != nil {
		// Notification failure must not fail the main operation (logging only).
		// This is a side-effect; user can still book even if notification fails.
		_ = err
	}
}

func (s *NotificationService) NotifyBookingCreated(ctx context.Context, userID, txnID uint, destName string) {
	s.notify(ctx, userID, NotifBookingCreated,
		"Booking Dibuat",
		fmt.Sprintf("Booking untuk %s berhasil dibuat, menunggu pembayaran.", destName),
		&txnID)
}

func (s *NotificationService) NotifyPaymentSuccess(ctx context.Context, userID, txnID uint, destName string) {
	s.notify(ctx, userID, NotifTicketIssued,
		"Tiket Terbit",
		fmt.Sprintf("Pembayaran untuk %s berhasil. Tiket resmi terbit & terverifikasi.", destName),
		&txnID)
}

func (s *NotificationService) NotifyPromoUsed(ctx context.Context, userID, txnID uint, code string, discount int64) {
	title := "Promo Berhasil Dipakai"
	msg := fmt.Sprintf("Kode %s berhasil dipakai. Potongan: Rp %d.", code, discount)
	s.notify(ctx, userID, NotifPromoUsed, title, msg, &txnID)
}

func (s *NotificationService) List(ctx context.Context, userID uint, page, limit int) ([]models.Notification, int64, error) {
	return s.notifications.ListByUser(ctx, userID, page, limit)
}

func (s *NotificationService) UnreadCount(ctx context.Context, userID uint) (int64, error) {
	return s.notifications.UnreadCount(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, id, userID uint) error {
	return s.notifications.MarkRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllRead(ctx context.Context, userID uint) error {
	return s.notifications.MarkAllRead(ctx, userID)
}
