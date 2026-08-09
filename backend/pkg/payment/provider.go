package payment

import "context"

// Provider — payment gateway abstraction (Session 11 decision: SIMULATED, not
// Midtrans/Xendit; see SPEC.md §5). BookingService depends on
// this interface, NOT on concrete implementation; main.go determines
// which provider is injected (manual dependency injection, same pattern
// as repository/service). Upgrade to real gateway = implement
// new Provider + inject in main.go, without touching service/handler.
type Provider interface {
	// Charge processes payment for bookingID of amount.
	// Returns final status to apply to transaction (e.g. "PAID"),
	// or error if charge fails (transaction will be marked FAILED).
	Charge(ctx context.Context, bookingID uint, amount int64) (status string, err error)
}
