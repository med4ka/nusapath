# NusaPath (Smart Tourism App)

**An AI-assisted trip planning platform with IPFS-anchored digital tickets — built as a hackathon/competition prototype.**

NusaPath pairs an AI itinerary generator ("Gari") with a booking flow that pins each ticket's data to IPFS, giving each booking a verifiable, tamper-evident hash rather than a database row that could be silently edited. Built under competition time constraints, so — honestly — the backend is meaningfully further along than the frontend, which still has several pages that aren't wired up to real endpoints yet. That's noted explicitly below rather than glossed over.

## What Actually Works (Verified in Code)

- **AI trip generation** — `POST /api/smart-trip` calls Google's Gemini API directly, with a structured prompt that forces a strict JSON itinerary format (day-by-day themes and activities, budget/style-aware). This is a real API call, not a mock.
- **IPFS-anchored tickets** — `POST /api/booking` builds a ticket record, pins it to IPFS via the Pinata API, and stores the returned content hash (`ticket_hash`) alongside the booking in Postgres. If the IPFS pin fails, the booking still saves with a `PENDING_ON_CHAIN` placeholder rather than blocking the transaction — a reasonable fallback under a hackathon deadline.
- **Rate limiting** — 20 requests/minute per IP on the API, via Fiber's limiter middleware
- **DB connection pooling** — explicit `SetMaxIdleConns(10)` / `SetMaxOpenConns(100)` configured for Postgres/Supabase

## Corrections from the Original Description

Being precise about what's implemented vs. what was aspirational:

- **"Encrypted ticket data"** — the ticket payload sent to IPFS is a plain formatted string (name, destination, timestamp), not actually encrypted. If encryption is added later, it'd sit between booking creation and the `PinToIPFS` call.
- **No authentication layer exists yet** — every endpoint (`/destinations`, `/booking`, `/smart-trip`, `/facilities`) is currently open, with no JWT or session check. Fine for a demo, not for anything handling real payments.
- **Several frontend routes have no corresponding backend endpoint** — the frontend includes pages for `merchandise`, `trending`, `transaction`, and `tripassist` that don't map to anything in the current API (`/destinations`, `/booking`, `/smart-trip`, `/facilities`, `/seed`). These are likely UI-only at this stage.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Go, Fiber v2, GORM |
| Database | PostgreSQL (Supabase-compatible) |
| AI | Google Gemini (direct REST call, no SDK) |
| Decentralized Storage | IPFS via Pinata |

## Getting Started

### Prerequisites
- Node.js 18+
- Go 1.25+
- A PostgreSQL/Supabase connection string
- A Google Gemini API key
- A Pinata JWT (for IPFS pinning)

### Backend

Create `backend/.env`:
```
DATABASE_URL=your_postgres_connection_string
GEMINI_API_KEY=your_gemini_api_key
PINATA_JWT=your_pinata_jwt
```

```bash
cd backend
go mod tidy
go run main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/destinations` | `GET` | List tourism destinations |
| `/api/facilities` | `GET` | List nearby facilities (with lat/lng) |
| `/api/smart-trip` | `POST` | Generate an AI itinerary via Gemini |
| `/api/booking` | `POST` | Create a booking, pin ticket to IPFS |
| `/api/seed` | `GET` | Seed initial destination data |

## Project Structure

```
smart-tourism-app/
├── backend/
│   ├── handlers/       # route handlers
│   ├── models/         # GORM models (Destination, Transaction, Facility)
│   ├── pkg/
│   │   ├── ai/          # Gemini integration
│   │   └── ipfs/        # Pinata/IPFS integration
│   └── main.go
│
└── frontend/
    └── app/
        ├── booking/
        ├── smartrip/
        ├── account/
        └── ...           # several routes here aren't backend-connected yet — see limitations above
```

## Status

Competition prototype. The AI itinerary engine and IPFS ticket-pinning are functional end-to-end. Authentication, payment integration, and several frontend sections are not yet built out.

---

*Built with Go, Fiber, Next.js, and the Gemini API.*
