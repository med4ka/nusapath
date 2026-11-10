# NusaPath

**An AI-assisted trip planning and booking platform for Indonesian destinations, with cryptographically verifiable e-tickets.**

NusaPath started as a hackathon prototype and was rebuilt from the ground up into a full booking platform: real authentication, three booking categories (destinations, transport, hotels), a working payment flow (simulated, but architected to drop in a real gateway), promo codes, cancellations, notifications, and a publicly verifiable ticket system anchored to IPFS.

## What NusaPath Does

- **Gari, the AI trip assistant**: chat-based itinerary planning powered by Gemini. Gari recommends real destinations from the catalog (never invents places that don't exist in the database) and can generate structured day-by-day itineraries on request. Rate-limited per user to keep API costs predictable.
- **Book destinations, transport, or hotels**: one unified booking flow across three categories: tourist destinations, flights/trains/buses, and hotel stays. Pricing is always resolved server-side from the database, never trusted from the client. This applies uniformly across all three categories and to promo code discounts.
- **Verifiable e-tickets**: once a booking is paid, its ticket data is pinned to IPFS and the resulting hash is stored with the booking. Anyone, with no account required, can paste that hash into the public verification page and confirm the ticket is real and untampered, without exposing the ticket holder's personal details.
- **Promo codes**: percentage or fixed-amount discounts, with optional per-user usage limits and global usage caps, validated atomically at booking time to prevent race conditions on limited-use codes.
- **Cancellations**: bookings can be cancelled before payment; seat/date holds are released back atomically.
- **Notifications**: booking confirmations, ticket issuance, and promo usage generate in-app notifications with an unread counter.
- **Wishlist & reviews**: save destinations for later; leave a rating and review only after a completed, ticket-issued booking (enforced server-side).
- **Admin panel**: manage destinations, transport routes, hotels, and promo codes without touching the database directly.
- **Dark mode & three languages**: Indonesian, English, and German, switchable without a page reload.

## What's Deliberately Simulated

Being upfront about the parts that aren't wired to real-world services, and why:

- **Payment is simulated**, not a real gateway integration. It's built behind a `Provider` interface specifically so a real processor (Midtrans, Xendit, etc.) can be dropped in later without touching booking logic, but as it stands, no real money moves. This is labeled clearly in the UI at checkout.
- **Transport and hotel schedules are admin-entered**, not pulled from live airline/rail/hotel APIs. There's no free, reliable public API for that at this scale, so availability is managed manually through the admin panel, the same way destination listings are.
- **The IPFS ticket payload isn't encrypted.** It's a structured, non-sensitive summary (destination/route/hotel, date, hash), not the ticket holder's personal data. It's *anchored* (tamper-evident) rather than *private*.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Go, Fiber, GORM |
| Database | PostgreSQL |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing |
| AI | Google Gemini (API key, direct REST) |
| Decentralized storage | IPFS via Pinata |

## Architecture

The backend follows a strict **Handler → Service → Repository** layering: handlers only parse requests and shape responses, business logic lives in services, and only repositories touch the database directly. This was a deliberate choice made early on, specifically so payment processing, seat/date holds, and promo validation could all be added later without handlers needing to know anything about SQL.

Money is always `int64` (whole Rupiah) throughout the stack, never a float, to avoid rounding ambiguity. Every price the client sees in a request body is re-derived and re-validated server-side before anything is charged.

## Getting Started

### Prerequisites

- Node.js 18+
- Go 1.23+
- A PostgreSQL connection string (database name: `nusapath`)
- A Google Gemini API key
- A Pinata JWT (for IPFS pinning)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET (32+ random chars), GEMINI_API_KEY, PINATA_JWT.
# Set PORT=8081 so it matches the frontend default.
go mod tidy
go run main.go
```

The server creates the tables on first run (GORM auto-migrate).

### Frontend

```bash
cd frontend
cp .env.example .env.local   # API_BASE_URL defaults to http://localhost:8081
npm install
npm run dev
```

Open `http://localhost:3000`.

### Create an admin and seed the catalog

New accounts are always created with the `user` role; admin promotion is only possible directly in the database. The seed endpoints are admin-only.

1. Register a normal account in the app (or via `POST /api/auth/register`).
2. Promote it in PostgreSQL:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
   ```

3. The role is stored in the JWT at login, so **log in again** after the change.
4. Log in from the command line and call the seed endpoints with the session cookie:

   ```bash
   curl -c cookies.txt -X POST http://localhost:8081/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"you@example.com","password":"your-password"}'

   curl -b cookies.txt http://localhost:8081/api/seed
   curl -b cookies.txt http://localhost:8081/api/seed-hotels
   curl -b cookies.txt http://localhost:8081/api/seed-transport
   ```

## Project Structure

```
nusapath/
├── backend/
│   ├── handlers/        # HTTP layer only
│   ├── service/         # business logic
│   ├── repository/      # the only layer that touches the DB
│   ├── middleware/      # auth, role checks, rate limiting
│   ├── pkg/
│   │   ├── auth/          # JWT + password hashing
│   │   ├── ai/            # Gemini client
│   │   ├── ipfs/          # Pinata client
│   │   └── payment/       # Provider interface + simulated implementation
│   └── models/          # GORM structs shared across layers
│
└── frontend/
    └── app/
        ├── destinations/, transport/, hotels/   # browse & book, per category
        ├── booking/                              # booking history, cancel, e-tickets
        ├── verify/                               # public ticket verification
        ├── account/, wishlist/, admin/
        └── components/                           # FloatingMascot (Gari), CheckoutModal, etc.
```

## Status

A working, portfolio-grade prototype: authentication, three booking categories, simulated payment with a real-gateway-ready architecture, promo codes, cancellations, notifications, wishlist, reviews, an admin panel, dark mode, and i18n are all implemented and working end to end. A security pass covering authorization, price integrity, rate limiting, and secret handling has been done.

**Testing:** there is no automated test suite yet; features were verified manually end to end.

**Not built, and not currently planned:** a real payment gateway, live transport/hotel data feeds, and encrypted ticket payloads.

**Possible next steps:** automated tests for booking and promo logic, restricting CORS origins for production, and using POST instead of GET for the seed endpoints.

---

*Built with Go, Fiber, Next.js, and the Gemini API.*