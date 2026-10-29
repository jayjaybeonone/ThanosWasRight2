"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// Allowed statuses per table. The owner dashboard can only move records between these.
const STATUSES = {
  bookings: ["pending", "confirmed", "out", "returned", "cancelled"],
  locker_reservations: ["pending", "active", "ended"],
  consignments: ["received", "listed", "sold", "paid_out", "returned"],
};

// Opens (and creates if needed) the SQLite database. Set DB_PATH to store it elsewhere.
function openDatabase(file) {
  const target = file || process.env.DB_PATH || path.join(__dirname, "data", "atelier.db");
  if (target !== ":memory:") fs.mkdirSync(path.dirname(target), { recursive: true });

  const db = new DatabaseSync(target);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS bookings (
      ref        TEXT PRIMARY KEY,
      item       TEXT NOT NULL,
      start_day  INTEGER NOT NULL,
      end_day    INTEGER NOT NULL,
      blocks     INTEGER NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      total      INTEGER NOT NULL,
      hold       INTEGER NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_item ON bookings (item, start_day, end_day);

    CREATE TABLE IF NOT EXISTS locker_reservations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      units      INTEGER NOT NULL,
      plan_rate  INTEGER NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consignments (
      ref        TEXT PRIMARY KEY,
      item       TEXT NOT NULL,
      hair_type  TEXT NOT NULL,
      condition  TEXT NOT NULL,
      price      INTEGER NOT NULL,
      rate       INTEGER NOT NULL,
      owner      TEXT NOT NULL,
      email      TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'received',
      created_at TEXT NOT NULL
    );
  `);

  // Databases created before the status column existed get it added here.
  function ensureColumn(table, column, definition) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  ensureColumn("bookings", "status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn("locker_reservations", "status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn("consignments", "status", "TEXT NOT NULL DEFAULT 'received'");

  const api = {
    // Returns the booking that blocks [start, end] for this item, including the buffer, or null.
    // Cancelled bookings don't block anything.
    findConflict(item, start, end, bufferDays) {
      return db.prepare(`
        SELECT ref, start_day, end_day FROM bookings
        WHERE item = ? AND status != 'cancelled'
          AND ? <= end_day + ? AND ? >= start_day - ?
        LIMIT 1
      `).get(item, start, bufferDays, end, bufferDays) || null;
    },

    // Checks for a conflict and inserts in one transaction, so two requests can't both claim the same slot.
    // Returns { ok: true } or { ok: false, reason: "conflict" }.
    insertBookingIfFree(b, bufferDays) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (api.findConflict(b.item, b.start, b.end, bufferDays)) {
          db.exec("ROLLBACK");
          return { ok: false, reason: "conflict" };
        }
        db.prepare(`
          INSERT INTO bookings (ref, item, start_day, end_day, blocks, name, email, total, hold, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(b.ref, b.item, b.start, b.end, b.blocks, b.name, b.email, b.total, b.hold, b.created_at);
        db.exec("COMMIT");
        return { ok: true };
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },

    insertLockerReservation(r) {
      db.prepare(`
        INSERT INTO locker_reservations (units, plan_rate, name, email, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(r.units, r.plan_rate, r.name, r.email, r.created_at);
    },

    insertConsignment(c) {
      db.prepare(`
        INSERT INTO consignments (ref, item, hair_type, condition, price, rate, owner, email, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
      `).run(c.ref, c.item, c.hair_type, c.condition, c.price, c.rate, c.owner, c.email, c.created_at);
    },

    // ----- Owner dashboard queries -----
    listBookings(limit = 200) {
      return db.prepare(`SELECT * FROM bookings ORDER BY start_day DESC, created_at DESC LIMIT ?`).all(limit);
    },

    listLocker(limit = 200) {
      return db.prepare(`SELECT * FROM locker_reservations ORDER BY created_at DESC LIMIT ?`).all(limit);
    },

    listConsignments(limit = 200) {
      return db.prepare(`SELECT * FROM consignments ORDER BY created_at DESC LIMIT ?`).all(limit);
    },

    // Updates a status after checking it belongs to that table's allowed list. Returns true if a row changed.
    setStatus(table, key, column, status) {
      if (!STATUSES[table] || !STATUSES[table].includes(status)) {
        throw Object.assign(new Error("Invalid status for this record."), { status: 400 });
      }
      const result = db.prepare(`UPDATE ${table} SET status = ? WHERE ${column} = ?`).run(status, key);
      return result.changes > 0;
    },

    summary(todayDay) {
      const bookings = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN status IN ('pending','confirmed','out') AND end_day >= ? THEN 1 ELSE 0 END) AS upcoming,
          SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS revenue,
          SUM(CASE WHEN status != 'cancelled' THEN hold ELSE 0 END) AS holds_open
        FROM bookings
      `).get(todayDay);

      const locker = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'active' THEN units ELSE 0 END), 0) AS active_units,
          COALESCE(SUM(CASE WHEN status = 'active' THEN units * plan_rate ELSE 0 END), 0) AS monthly_recurring,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
        FROM locker_reservations
      `).get();

      const consign = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status IN ('received','listed') THEN 1 ELSE 0 END) AS in_store,
          SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold
        FROM consignments
      `).get();

      // SUM() returns NULL over an empty table, so every count is coerced to a number here.
      const n = (v) => Number(v) || 0;
      return {
        bookings: { total: n(bookings.total), pending: n(bookings.pending), upcoming: n(bookings.upcoming), revenue: n(bookings.revenue), holdsOpen: n(bookings.holds_open) },
        locker: { activeUnits: n(locker.active_units), monthlyRecurring: n(locker.monthly_recurring), pending: n(locker.pending) },
        consignments: { total: n(consign.total), inStore: n(consign.in_store), sold: n(consign.sold) },
      };
    },

    close() {
      db.close();
    },
  };

  return api;
}

module.exports = { openDatabase, STATUSES };
