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

## Deploying to Fly.io

The easiest way is the script, run from your own computer (not this sandbox). It installs `flyctl` if needed, signs you in, and creates the app, volume, and owner token when missing before deploying. It is safe to run again:

```bash
./scripts/deploy-fly.sh
# or with email:
RESEND_API_KEY=re_xxx EMAIL_FROM="The Wig Atelier <bookings@yourdomain.com>" ./scripts/deploy-fly.sh
```

The owner token is saved to `~/.config/wig-atelier/owner-token`. The manual steps below do the same thing.

### Manual steps

The app runs in one container with a 1 GB volume for the database. Run these commands from the repo root.
You need a Fly.io account and the `flyctl` CLI (`brew install flyctl` on macOS).

```bash
fly auth login
fly launch --no-deploy --copy-config --name <your-app-name>   # uses fly.toml; change the name if it's taken
fly volumes create atelier_data --size 1 --region iad         # region must match primary_region in fly.toml
fly secrets set ADMIN_TOKEN="$(openssl rand -hex 32)"      # owner dashboard password; save it somewhere safe
# Optional, for confirmation emails:
fly secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="The Wig Atelier <bookings@yourdomain.com>"
fly deploy
```

Then open `https://<your-app-name>.fly.dev` for the site and `/owner` for the dashboard.

Notes:
- Keep exactly one machine. SQLite allows one writer, and the volume belongs to one machine.
- Data lives on the `atelier_data` volume. Deleting the app deletes the volume, so back it up before taking it down.
- Fly.io provisions HTTPS for `*.fly.dev` automatically. Use a custom domain before taking real customer details.
- The Dockerfile at the repo root builds the image. Node needs no packages to install.

Payments and automatic status emails are not implemented yet.
