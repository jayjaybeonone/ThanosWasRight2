# The Wig Atelier & Vault — server

Serves the website in `../website` and stores rental bookings, Wig Locker reservations,
and consignment intakes in a local SQLite database.

No `npm install` is needed. It uses only Node built-ins.

## Requirements

- Node.js 22.13 or newer (for the built-in `node:sqlite` module)

## Run it

```bash
cd server
npm start              # http://localhost:3000
PORT=8080 npm start    # use another port
ADMIN_TOKEN=$(openssl rand -hex 32) npm start   # enables the owner dashboard
npm test               # run the API tests
```

## Configuration (environment variables)

| Variable         | Default                     | Purpose                                                    |
|------------------|-----------------------------|------------------------------------------------------------|
| `PORT`           | `3000`                      | HTTP port                                                  |
| `DB_PATH`        | `server/data/atelier.db`    | Where the SQLite database is stored                        |
| `RESEND_API_KEY` | unset                       | Enables confirmation emails through [Resend](https://resend.com) |
| `EMAIL_FROM`     | unset                       | Sender address, e.g. `Atelier <bookings@yourdomain.com>` (the domain must be verified in Resend) |
| `ADMIN_TOKEN`    | unset                       | Password for the owner dashboard at `/owner`. Unset means the dashboard is turned off. Use at least 32 random characters. |

Without `RESEND_API_KEY` and `EMAIL_FROM`, the server logs the emails it would have sent
and everything else works.

## Business rules

Prices and rules live in `config.js`. The browser loads them from `GET /api/catalog`,
and the server recalculates every total, so the browser can't change a price.

- A rental is booked in 4-day blocks (1 to 3 blocks).
- Each booking keeps the item unavailable for 4 days before and after its dates.
- Booking and availability checks happen in one database transaction, so two people
  can't book the same slot at once.

## API

| Method | Path                | Body / query                                              | Returns |
|--------|---------------------|-----------------------------------------------------------|---------|
| GET    | `/api/catalog`      |                                                           | items and rules |
| GET    | `/api/availability` | `item`, `start` (YYYY-MM-DD), `blocks`                    | `{ available, reason, start, end }` |
| POST   | `/api/bookings`     | `item`, `start`, `blocks`, `name`, `email`                | `201 { ref, start, end, total, hold, emailed }` |
| POST   | `/api/locker`       | `units`, `plan` (19, 29, or 39), `name`, `email`          | `201 { monthly, emailed }` |
| POST   | `/api/consign`      | `item`, `type`, `condition`, `price`, `rate`, `owner`, `email` | `201 { ref, payout, emailed }` |

Errors return `{ "error": "message" }` with a 400, 404, 409, or 413 status.

## Owner dashboard

Open `/owner` and sign in with `ADMIN_TOKEN`. The dashboard shows:

- **Summary:** upcoming rentals, rental revenue, open security holds, active locker units and monthly recurring revenue, and consignments in store and sold.
- **Rentals, Wig Locker, and Consignments tabs:** every record, with a status filter.
- **Status changes:** each record has a status dropdown that saves when changed. Setting a booking to `cancelled` frees its dates.

The token is kept in `sessionStorage`, so it's forgotten when the browser tab closes. Owner routes return 401 for a wrong token and 503 when `ADMIN_TOKEN` is unset. Keep the token secret: anyone who has it can read every customer's name, email, and booking.

Statuses:

| Records      | Statuses                                              |
|--------------|-------------------------------------------------------|
| Rentals      | pending, confirmed, out, returned, cancelled          |
| Locker       | pending, active, ended                                |
| Consignments | received, listed, sold, paid_out, returned            |

Changing a status does not email the customer yet.

## Deploying

Any host that runs Node 22.13+ and keeps a writable disk will work (for example a VPS,
Render, or Railway). Set `DB_PATH` to a persistent disk location, or the bookings are lost
on each deploy. Put the server behind HTTPS before taking real customer details.

Payments and automatic status emails are not implemented yet.
