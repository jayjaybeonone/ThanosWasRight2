"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

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
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_item ON bookings (item, start_day, end_day);

    CREATE TABLE IF NOT EXISTS locker_reservations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      units      INTEGER NOT NULL,
      plan_rate  INTEGER NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
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
      created_at TEXT NOT NULL
    );
  `);

  return {
    // Returns the booking that blocks [start, end] for this item, including the buffer, or null.
    findConflict(item, start, end, bufferDays) {
      return db.prepare(`
        SELECT ref, start_day, end_day FROM bookings
        WHERE item = ? AND ? <= end_day + ? AND ? >= start_day - ?
        LIMIT 1
      `).get(item, start, bufferDays, end, bufferDays) || null;
    },

    // Checks for a conflict and inserts in one transaction, so two requests can't both claim the same slot.
    // Returns { ok: true } or { ok: false, reason: "conflict" }.
    insertBookingIfFree(b, bufferDays) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (this.findConflict(b.item, b.start, b.end, bufferDays)) {
          db.exec("ROLLBACK");
          return { ok: false, reason: "conflict" };
        }
        db.prepare(`
          INSERT INTO bookings (ref, item, start_day, end_day, blocks, name, email, total, hold, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT INTO locker_reservations (units, plan_rate, name, email, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(r.units, r.plan_rate, r.name, r.email, r.created_at);
    },

    insertConsignment(c) {
      db.prepare(`
        INSERT INTO consignments (ref, item, hair_type, condition, price, rate, owner, email, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(c.ref, c.item, c.hair_type, c.condition, c.price, c.rate, c.owner, c.email, c.created_at);
    },

    close() {
      db.close();
    },
  };
}

module.exports = { openDatabase };
