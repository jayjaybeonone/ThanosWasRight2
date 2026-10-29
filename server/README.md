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
npm test               # run the API tests
```

## Configuration (environment variables)

| Variable         | Default                     | Purpose                                                    |
|------------------|-----------------------------|------------------------------------------------------------|
| `PORT`           | `3000`                      | HTTP port                                                  |
| `DB_PATH`        | `server/data/atelier.db`    | Where the SQLite database is stored                        |
| `RESEND_API_KEY` | unset                       | Enables confirmation emails through [Resend](https://resend.com) |
| `EMAIL_FROM`     | unset                       | Sender address, e.g. `Atelier <bookings@yourdomain.com>` (the domain must be verified in Resend) |

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

## Deploying

Any host that runs Node 22.13+ and keeps a writable disk will work (for example a VPS,
Render, or Railway). Set `DB_PATH` to a persistent disk location, or the bookings are lost
on each deploy. Put the server behind HTTPS before taking real customer details.

Payments, holds, and the owner dashboard are not implemented yet.
