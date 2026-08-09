package payment

import (
	"context"
	"math/rand"
	"time"
)

// SimulatedProvider — "fake buy" (Session 11 decision): always succeeds,
// with artificial delay 1–2 seconds to feel like "processing". This is purely
// for UX, not deceptive — UI MUST be labeled "Simulasi" around the pay
// button (SPEC.md §5 acceptance criteria). No real money changes hands.
type SimulatedProvider struct {
	minDelay time.Duration
	maxDelay time.Duration
}

func NewSimulatedProvider() *SimulatedProvider {
	return &SimulatedProvider{minDelay: 1 * time.Second, maxDelay: 2 * time.Second}
}

// Charge always succeeds. Random delay 1–2 seconds taken ONCE per invocation.
func (p *SimulatedProvider) Charge(_ context.Context, _ uint, _ int64) (string, error) {
	delay := p.minDelay
	if p.maxDelay > p.minDelay {
		extra := time.Duration(rand.Int63n(int64(p.maxDelay-p.minDelay)))
		delay += extra
	}
	time.Sleep(delay)
	// Always succeeds — status the service requests to be applied.
	return "PAID", nil
}
