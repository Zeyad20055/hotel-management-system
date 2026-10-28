# Hotel Management System

Full-stack hotel management application: **React + Vite + Tailwind** frontend, **Node.js + Express** REST API, **MongoDB + Mongoose** database, JWT auth with role-based access, Arabic (RTL) / English (LTR).

## Features
- **Dashboard** – rooms by state, today's check-ins/outs, active & upcoming reservations, guests, collected revenue (today / month), outstanding balances, revenue / occupancy / status charts, recent activity, quick actions. All numbers come from backend aggregation.
- **Rooms** – CRUD, search by number, filter (floor, type, status, price), sort, table + card views, details with upcoming bookings. Unique numbers; deletion blocked when reservations exist.
- **Guests** – CRUD, search (name/phone/email/ID), duplicate prevention, ID numbers masked in lists, profile with stays, spending and outstanding balance. Guests with history are deactivated, not deleted.
- **Reservations** – guest picker or new guest, date + room availability search, multi-room, services, authorised discounts, server-side price quote and breakdown, confirm / edit / cancel / no-show, printable confirmation & invoice, search + filters.
- **Double-booking protection** – the backend validates the whole date range against active reservations on create, edit and confirm, and serialises booking operations (see *Limitations*). Client-sent prices/totals are ignored.
- **Reception** – today's arrivals, in-house guests, check-in (with deposit), check-out (final bill, payment, outstanding-balance handling), check-in/out history.
- **Payments** – partial/full payments, balances, filters, receipts, refunds (Super Admin / Admin / Accountant, reason required), idempotency keys against double submission. No card data is ever stored.
- **Available rooms** page (date range, guests, type, price filters, book button) and **Reserved rooms** page (room / guest / booking no. / dates / nights / total / payment & status). Dashboard shows room states for any chosen date (`GET /api/rooms/occupancy?date=`).
- **Services**, **Housekeeping** (tasks, room board, staff see only their own tasks), **Maintenance** (blocking requests remove a room from booking).
- **Reports** – revenue (collected vs booked, services), occupancy & room performance, reservations (cancellation rate, check-in/out), payments (methods, outstanding), guests. Date filters, print, CSV export.
- **Employees & roles** – Super Admin, Administrator, Receptionist, Accountant, Housekeeping. Permissions are enforced by backend middleware.
- **Settings** – hotel name, currency, tax rate, time zone, discount policy, extra payment methods.
- **Audit log** for important operations.

> 📘 التوثيق العربي الكامل: [`PROJECT_DOCUMENTATION_AR.md`](PROJECT_DOCUMENTATION_AR.md)

## Quick start
Requirements: Node.js ≥ 18.18 (and optionally MongoDB).

```bash
npm install
npm run dev
```
Open **http://localhost:5173**. The API runs on port 5000 (proxied through Vite, so no ports are hard-coded).

### Windows PowerShell
```powershell
npm install
npm run setup:env     # optional: creates .env from .env.example
npm run dev
```

### Database modes
| Mode | When | Persistent? |
|---|---|---|
| **A – MongoDB** | `MONGODB_URI` is set in `.env` (e.g. `mongodb://127.0.0.1:27017/hotel_management`) | **Yes** |
| **B – Temporary in-memory** (development only) | `MONGODB_URI` empty and `NODE_ENV` ≠ production | **No – data is lost when the server stops** |

Mode B uses `mongodb-memory-server`, which downloads a MongoDB binary on first start (internet required once). Demo data is seeded automatically. Production never falls back to memory mode – it refuses to start without `MONGODB_URI`.
If MongoDB cannot be reached the server exits with an actionable message, and `/api/health` reports the true state (`503` when degraded). If the API is down the UI shows a "Cannot reach the server" screen instead of pretending to work.

To use a persistent database: `npm run setup:env`, edit `.env`, set `MONGODB_URI`, then `npm run dev`. Seed demo data into it with `npm run seed` (add `-- --force` to add it to a non-empty DB).

### First administrator
- **Development:** on an empty database `admin@hotel.local` / `Admin@12345` is created and **must be changed at first login** (the API blocks everything else until you do).
- **Production:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (≥ 10 chars) in the environment; the first Super Admin is created from them. No default credentials exist in production.
- Demo data (dev only) also creates: `manager@hotel.local / Manager@12345` (Administrator), `reception@hotel.local / Recep@12345`, `accountant@hotel.local / Account@12345`, `housekeeping@hotel.local / House@12345`.

## Environment variables (`.env`, see `.env.example`)
`PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET` (≥ 32 chars, required in production), `JWT_EXPIRES_IN`, `ADMIN_NAME/EMAIL/PASSWORD`, `SEED_DEMO`, `CLIENT_ORIGIN` (only if the UI is hosted on a different origin), `CLIENT_PORT`.

## Production
```bash
npm install
npm run build            # builds client/dist
# set NODE_ENV=production, MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm start                # Express serves the API and the built client on PORT
```

## Tests & checks
```bash
npm test        # Vitest + Supertest (41 backend tests)
npm run lint
npm run build
```
Tests use an in-memory MongoDB by default; to use an existing server set `TEST_MONGODB_URI=mongodb://127.0.0.1:27017` (a throw-away database `hotel_test_api` is created and dropped).
Covered: health, authentication, password change, role restrictions, room & guest CRUD, invalid/past dates, overlapping bookings, 8 concurrent bookings of one room, maintenance blocking, discounts, check-in/out, repeat check-out, payment balances, overpayment, idempotency, refunds, housekeeping flow, dashboard and reports.

## Project structure
```
client/src  api/ components/ context/ hooks/ i18n/ layouts/ pages/ utils/
server      config/ models/ routes/ middlewares/ services/ validators/ utils/ tests/
            app.js server.js bootstrap.js (admin + demo seed) seed-cli.js
scripts/    setup-env.js
```
Business rules live in `server/services` (reservation, availability, pricing, payment); routes hold HTTP concerns, `validators/schemas.js` holds Zod schemas.

## API overview (all under `/api`, JSON `{success, data, meta?}`)
`GET /health` · `POST /auth/login|logout|change-password`, `GET /auth/me` · `/users` · `/rooms` (+ `/availability`) · `/guests` · `/reservations` (+ `/quote`, `/arrivals`, `/in-house`, `/:id/confirm|cancel|no-show|check-in|check-out|charges`) · `/payments` (+ `/:id/refund`) · `/services` · `/housekeeping` · `/maintenance` · `/settings` · `/dashboard/summary|revenue|occupancy|notifications` · `/reports/revenue|occupancy|reservations|payments|guests` (`?format=csv`) · `/audit`.

## Security notes
JWT in an `httpOnly`, `SameSite=Lax` cookie; bcrypt (cost 12); Helmet; login/password rate limiting; Zod validation on every write; NoSQL-operator sanitising; 100 kb body limit; CSV formula-injection guard; no passwords/hashes in responses; audit logging.

## Common problems
- **"Cannot connect to MongoDB"** – start MongoDB or fix `MONGODB_URI`; clear it to use the temporary dev database.
- **"Could not start the temporary in-memory MongoDB"** – the binary download failed (offline/proxy). Install MongoDB and set `MONGODB_URI`.
- **Port in use** – change `PORT` / `CLIENT_PORT` in `.env`.
- **UI says "Cannot reach the server"** – the API is not running; check the `[api]` log lines.
- **Logged out after every restart in dev** – set a fixed `JWT_SECRET`.

## Limitations
- Booking operations are serialised **inside one Node process**. For several API instances use a MongoDB replica set and move the booking logic into transactions.
- Room images are URLs only (no file uploads). Printing uses the browser print dialog ("Save as PDF" for downloads).
- Card payments are recorded manually; no payment gateway is integrated.
