"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ITEMS, RULES } = require("./config");
const { openDatabase } = require("./db");
const { sendEmail } = require("./email");

const DAY = 86400000;
const WEBSITE_DIR = path.join(__dirname, "..", "website");
const MAX_BODY = 16 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

// ----- Date helpers: a "day" is a whole-day integer, so timezones can't shift results -----
function parseDay(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return Math.round(ms / DAY);
}

function todayDay() {
  const now = new Date();
  return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);
}

function dayToIso(day) {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

function newRef(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function isEmail(v) {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function cleanText(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// ----- Validation: returns { value } or { error } -----
function validateBooking(body) {
  const item = ITEMS.find((i) => i.id === body.item);
  if (!item) return { error: "Choose a wig from the catalog." };

  const blocks = Number(body.blocks);
  if (!Number.isInteger(blocks) || blocks < 1 || blocks > RULES.maxBlocks) {
    return { error: `Choose between 1 and ${RULES.maxBlocks} blocks.` };
  }

  const start = parseDay(body.start);
  if (start === null) return { error: "Enter a valid start date." };
  if (start < todayDay()) return { error: "Start date must be today or later." };

  const name = cleanText(body.name, 100);
  if (!name) return { error: "Enter your name." };
  const email = cleanText(body.email, 254);
  if (!isEmail(email)) return { error: "Enter a valid email address." };

  const end = start + blocks * RULES.blockDays - 1;
  return {
    value: {
      item: item.id,
      itemName: item.name,
      start,
      end,
      blocks,
      name,
      email,
      total: item.price * blocks + RULES.fee,   // computed on the server, never trusted from the client
      hold: item.hold,
    },
  };
}

function validateLocker(body) {
  const units = Number(body.units);
  if (!Number.isInteger(units) || units < 1 || units > RULES.maxUnits) {
    return { error: `Units must be between 1 and ${RULES.maxUnits}.` };
  }
  const rate = Number(body.plan);
  if (!Object.prototype.hasOwnProperty.call(RULES.lockerPlans, rate)) {
    return { error: "Choose a valid locker plan." };
  }
  const name = cleanText(body.name, 100);
  if (!name) return { error: "Enter your name." };
  const email = cleanText(body.email, 254);
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  return { value: { units, rate, name, email } };
}

const CONDITIONS = [
  "Like new (worn once or twice)",
  "Excellent",
  "Good (visible wear)",
  "Fair (needs restyling)",
];
const HAIR_TYPES = ["Human hair", "Synthetic", "Blend"];

function validateConsignment(body) {
  const item = cleanText(body.item, 150);
  if (!item) return { error: "Enter the item name." };
  const hairType = HAIR_TYPES.includes(body.type) ? body.type : null;
  if (!hairType) return { error: "Choose a hair type." };
  const condition = CONDITIONS.includes(body.condition) ? body.condition : null;
  if (!condition) return { error: "Choose a condition." };
  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0 || price > 100000) {
    return { error: "Enter an asking price between $1 and $100,000." };
  }
  const rate = Number(body.rate);
  if (!RULES.commissionRates.includes(rate)) return { error: "Choose a valid commission rate." };
  const owner = cleanText(body.owner, 100);
  if (!owner) return { error: "Enter your name." };
  const email = cleanText(body.email, 254);
  if (!isEmail(email)) return { error: "Enter a valid email address." };
  return { value: { item, hair_type: hairType, condition, price: Math.round(price), rate, owner, email } };
}

// ----- HTTP helpers -----
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (err) {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(WEBSITE_DIR, requested));
  // Block path traversal: the resolved path must stay inside the website folder.
  if (!file.startsWith(WEBSITE_DIR + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

function formatMoney(n) {
  return `$${n.toLocaleString("en-US")}`;
}

function createApp(options = {}) {
  const db = options.db || openDatabase(options.dbPath);

  async function handleApi(req, res, url) {
    if (req.method === "GET" && url.pathname === "/api/catalog") {
      return sendJson(res, 200, {
        items: ITEMS,
        rules: {
          blockDays: RULES.blockDays,
          bufferDays: RULES.bufferDays,
          maxBlocks: RULES.maxBlocks,
          fee: RULES.fee,
          lockerPlans: RULES.lockerPlans,
          maxUnits: RULES.maxUnits,
          commissionRates: RULES.commissionRates,
        },
      });
    }

    if (req.method === "GET" && url.pathname === "/api/availability") {
      const item = ITEMS.find((i) => i.id === url.searchParams.get("item"));
      const start = parseDay(url.searchParams.get("start"));
      const blocks = Number(url.searchParams.get("blocks") || 1);
      if (!item) return sendJson(res, 400, { error: "Unknown item." });
      if (start === null || !Number.isInteger(blocks) || blocks < 1 || blocks > RULES.maxBlocks) {
        return sendJson(res, 400, { error: "Invalid dates." });
      }
      const end = start + blocks * RULES.blockDays - 1;
      if (start < todayDay()) {
        return sendJson(res, 200, { available: false, reason: "past", start: dayToIso(start), end: dayToIso(end) });
      }
      const conflict = db.findConflict(item.id, start, end, RULES.bufferDays);
      return sendJson(res, 200, {
        available: !conflict,
        reason: conflict ? "conflict" : null,
        start: dayToIso(start),
        end: dayToIso(end),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/bookings") {
      const { value, error } = validateBooking(await readJson(req));
      if (error) return sendJson(res, 400, { error });

      const booking = { ...value, ref: newRef("BK"), created_at: new Date().toISOString() };
      const result = db.insertBookingIfFree(booking, RULES.bufferDays);
      if (!result.ok) {
        return sendJson(res, 409, { error: "That item is not available for those dates, including the 4-day turnaround buffer. Please pick another start date." });
      }

      const emailResult = await sendEmail({
        to: booking.email,
        subject: `Booking request ${booking.ref}: ${booking.itemName}`,
        text: [
          `Hi ${booking.name},`,
          "",
          `We received your rental request for ${booking.itemName}.`,
          `Dates: ${dayToIso(booking.start)} to ${dayToIso(booking.end)} (${booking.blocks} block${booking.blocks > 1 ? "s" : ""})`,
          `Due today: ${formatMoney(booking.total)} (includes the $${RULES.fee} shipping and hygiene fee)`,
          `Security hold: ${formatMoney(booking.hold)} (authorized, not charged)`,
          "",
          `Reference: ${booking.ref}`,
          "We will confirm shortly.",
        ].join("\n"),
      });

      return sendJson(res, 201, {
        ref: booking.ref,
        start: dayToIso(booking.start),
        end: dayToIso(booking.end),
        total: booking.total,
        hold: booking.hold,
        emailed: emailResult.sent,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/locker") {
      const { value, error } = validateLocker(await readJson(req));
      if (error) return sendJson(res, 400, { error });

      db.insertLockerReservation({ ...value, plan_rate: value.rate, created_at: new Date().toISOString() });
      const planName = RULES.lockerPlans[value.rate];
      const emailResult = await sendEmail({
        to: value.email,
        subject: "Wig Locker reservation received",
        text: [
          `Hi ${value.name},`,
          "",
          `We received your Wig Locker request: ${value.units} unit${value.units > 1 ? "s" : ""} on the ${planName} plan.`,
          `Monthly total: ${formatMoney(value.units * value.rate)}`,
          "",
          "We will email intake instructions shortly.",
        ].join("\n"),
      });
      return sendJson(res, 201, { monthly: value.units * value.rate, emailed: emailResult.sent });
    }

    if (req.method === "POST" && url.pathname === "/api/consign") {
      const { value, error } = validateConsignment(await readJson(req));
      if (error) return sendJson(res, 400, { error });

      const ref = newRef("CS");
      db.insertConsignment({ ...value, ref, created_at: new Date().toISOString() });
      const payout = value.price - Math.round((value.price * value.rate) / 100);
      const emailResult = await sendEmail({
        to: value.email,
        subject: `Consignment received ${ref}: ${value.item}`,
        text: [
          `Hi ${value.owner},`,
          "",
          `We received ${value.item}. Reference: ${ref}`,
          `Asking price: ${formatMoney(value.price)}`,
          `Commission: ${value.rate}% (you receive about ${formatMoney(payout)} at asking price)`,
          "",
          "The final valuation is set after our inspection.",
        ].join("\n"),
      });
      return sendJson(res, 201, { ref, payout, emailed: emailResult.sent });
    }

    return sendJson(res, 404, { error: "Not found." });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
      } else if (req.method === "GET" || req.method === "HEAD") {
        serveStatic(req, res, url.pathname);
      } else {
        res.writeHead(405).end("Method not allowed");
      }
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? "Something went wrong. Please try again." : err.message });
    }
  });

  return { server, db };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createApp();
  server.listen(port, () => {
    console.log(`The Wig Atelier & Vault running at http://localhost:${port}`);
  });
}

module.exports = { createApp, validateBooking, parseDay };
