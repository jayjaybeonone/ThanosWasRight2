"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../server");
const { openDatabase } = require("../db");

const DAY = 86400000;

function isoDaysFromToday(n) {
  const d = new Date();
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

async function start() {
  const db = openDatabase(":memory:");
  const { server } = createApp({ db });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    close: () => new Promise((resolve) => { server.close(resolve); db.close(); }),
  };
}

async function post(base, path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

test("catalog exposes prices and rules from the server", async () => {
  const s = await start();
  try {
    const res = await fetch(s.base + "/api/catalog");
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.items.length >= 1);
    assert.equal(data.rules.blockDays, 4);
    assert.equal(data.rules.bufferDays, 4);
  } finally {
    await s.close();
  }
});

test("booking total is computed on the server from the catalog price", async () => {
  const s = await start();
  try {
    const { status, data } = await post(s.base, "/api/bookings", {
      item: "platinum-glueless", start: isoDaysFromToday(3), blocks: 2, name: "Ada", email: "ada@example.com",
    });
    assert.equal(status, 201);
    assert.equal(data.total, 150 * 2 + 25);
    assert.equal(data.hold, 250);
    assert.match(data.ref, /^BK-[0-9A-F]{8}$/);
  } finally {
    await s.close();
  }
});

test("client cannot override the price", async () => {
  const s = await start();
  try {
    const { data } = await post(s.base, "/api/bookings", {
      item: "platinum-glueless", start: isoDaysFromToday(3), blocks: 1, name: "Ada", email: "ada@example.com", total: 1, price: 1,
    });
    assert.equal(data.total, 150 + 25);
  } finally {
    await s.close();
  }
});

test("4-day turnaround buffer blocks overlapping and too-close bookings, allows the day after", async () => {
  const s = await start();
  try {
    // Booking covers days +3..+6 (one block). Buffer runs through +10.
    const first = await post(s.base, "/api/bookings", {
      item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "A", email: "a@example.com",
    });
    assert.equal(first.status, 201);

    const overlap = await post(s.base, "/api/bookings", {
      item: "bob-synth", start: isoDaysFromToday(5), blocks: 1, name: "B", email: "b@example.com",
    });
    assert.equal(overlap.status, 409);

    const inBuffer = await post(s.base, "/api/bookings", {
      item: "bob-synth", start: isoDaysFromToday(9), blocks: 1, name: "C", email: "c@example.com",
    });
    assert.equal(inBuffer.status, 409);

    const free = await post(s.base, "/api/bookings", {
      item: "bob-synth", start: isoDaysFromToday(11), blocks: 1, name: "D", email: "d@example.com",
    });
    assert.equal(free.status, 201);

    // A different item is unaffected by the first booking.
    const otherItem = await post(s.base, "/api/bookings", {
      item: "jet-waist", start: isoDaysFromToday(3), blocks: 1, name: "E", email: "e@example.com",
    });
    assert.equal(otherItem.status, 201);
  } finally {
    await s.close();
  }
});

test("availability endpoint reports conflicts and past dates", async () => {
  const s = await start();
  try {
    await post(s.base, "/api/bookings", {
      item: "silver-pixie", start: isoDaysFromToday(3), blocks: 1, name: "A", email: "a@example.com",
    });
    const conflict = await (await fetch(`${s.base}/api/availability?item=silver-pixie&start=${isoDaysFromToday(4)}&blocks=1`)).json();
    assert.equal(conflict.available, false);
    assert.equal(conflict.reason, "conflict");

    const free = await (await fetch(`${s.base}/api/availability?item=silver-pixie&start=${isoDaysFromToday(20)}&blocks=1`)).json();
    assert.equal(free.available, true);

    const past = await (await fetch(`${s.base}/api/availability?item=silver-pixie&start=2000-01-01&blocks=1`)).json();
    assert.equal(past.available, false);
    assert.equal(past.reason, "past");
  } finally {
    await s.close();
  }
});

test("invalid booking input is rejected with a clear message", async () => {
  const s = await start();
  try {
    const cases = [
      [{ item: "nope", start: isoDaysFromToday(3), blocks: 1, name: "A", email: "a@example.com" }, /catalog/],
      [{ item: "bob-synth", start: isoDaysFromToday(3), blocks: 9, name: "A", email: "a@example.com" }, /blocks/],
      [{ item: "bob-synth", start: "2026-02-30", blocks: 1, name: "A", email: "a@example.com" }, /start date/],
      [{ item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "", email: "a@example.com" }, /name/],
      [{ item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "A", email: "not-an-email" }, /email/],
    ];
    for (const [body, message] of cases) {
      const { status, data } = await post(s.base, "/api/bookings", body);
      assert.equal(status, 400);
      assert.match(data.error, message);
    }
  } finally {
    await s.close();
  }
});

test("locker and consignment submissions are validated and stored", async () => {
  const s = await start();
  try {
    const locker = await post(s.base, "/api/locker", { units: 3, plan: 39, name: "Ada", email: "ada@example.com" });
    assert.equal(locker.status, 201);
    assert.equal(locker.data.monthly, 117);

    const badPlan = await post(s.base, "/api/locker", { units: 3, plan: 5, name: "Ada", email: "ada@example.com" });
    assert.equal(badPlan.status, 400);

    const consign = await post(s.base, "/api/consign", {
      item: "Chestnut bob", type: "Human hair", condition: "Excellent", price: 500, rate: 35, owner: "Ada", email: "ada@example.com",
    });
    assert.equal(consign.status, 201);
    assert.equal(consign.data.payout, 325);

    const badRate = await post(s.base, "/api/consign", {
      item: "x", type: "Human hair", condition: "Excellent", price: 500, rate: 99, owner: "Ada", email: "ada@example.com",
    });
    assert.equal(badRate.status, 400);
  } finally {
    await s.close();
  }
});

test("static files are served and path traversal is blocked", async () => {
  const s = await start();
  try {
    const home = await fetch(s.base + "/");
    assert.equal(home.status, 200);
    assert.match(await home.text(), /The Wig Atelier/);

    const css = await fetch(s.base + "/styles.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /text\/css/);

    const traversal = await fetch(s.base + "/..%2Fserver%2Fserver.js");
    assert.notEqual(traversal.status, 200);
  } finally {
    await s.close();
  }
});

test("oversized request bodies are rejected", async () => {
  const s = await start();
  try {
    const res = await fetch(s.base + "/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(40 * 1024) }),
    }).catch((err) => ({ status: 413, err }));
    assert.equal(res.status, 413);
  } finally {
    await s.close();
  }
});

// ----- Owner dashboard -----

const TOKEN = "test-owner-token-with-enough-length-123";

async function startAdmin(token = TOKEN) {
  const db = openDatabase(":memory:");
  const { server } = createApp({ db, adminToken: token });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, db, close: () => new Promise((resolve) => { server.close(resolve); db.close(); }) };
}

function admin(base, path, options = {}, token = TOKEN) {
  return fetch(base + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
}

test("owner routes are disabled when ADMIN_TOKEN is not set", async () => {
  const s = await startAdmin("");
  try {
    const res = await fetch(s.base + "/api/admin/summary", { headers: { Authorization: "Bearer anything" } });
    assert.equal(res.status, 503);
  } finally {
    await s.close();
  }
});

test("owner routes reject missing and wrong tokens", async () => {
  const s = await startAdmin();
  try {
    const none = await fetch(s.base + "/api/admin/summary");
    assert.equal(none.status, 401);
    const wrong = await admin(s.base, "/api/admin/summary", {}, "wrong-token");
    assert.equal(wrong.status, 401);
    const ok = await admin(s.base, "/api/admin/summary");
    assert.equal(ok.status, 200);
  } finally {
    await s.close();
  }
});

test("owner can list records with item names and readable dates", async () => {
  const s = await startAdmin();
  try {
    await post(s.base, "/api/bookings", { item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "Ada", email: "ada@example.com" });
    const res = await admin(s.base, "/api/admin/bookings");
    const data = await res.json();
    assert.equal(data.records.length, 1);
    const b = data.records[0];
    assert.equal(b.itemName, "Heat-Resistant Synthetic Bob");
    assert.equal(b.status, "pending");
    assert.match(b.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(b.start, isoDaysFromToday(3));
    assert.equal(b.end, isoDaysFromToday(6));
  } finally {
    await s.close();
  }
});

test("owner can confirm, return, and cancel a booking", async () => {
  const s = await startAdmin();
  try {
    const created = await post(s.base, "/api/bookings", { item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "Ada", email: "ada@example.com" });
    const ref = created.data.ref;

    const confirm = await admin(s.base, `/api/admin/bookings/${ref}`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
    assert.equal(confirm.status, 200);

    const bad = await admin(s.base, `/api/admin/bookings/${ref}`, { method: "PATCH", body: JSON.stringify({ status: "shipped" }) });
    assert.equal(bad.status, 400);

    const missing = await admin(s.base, `/api/admin/bookings/BK-NOPE0000`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
    assert.equal(missing.status, 404);
  } finally {
    await s.close();
  }
});

test("cancelled bookings free the slot for new customers", async () => {
  const s = await startAdmin();
  try {
    const created = await post(s.base, "/api/bookings", { item: "bob-synth", start: isoDaysFromToday(3), blocks: 1, name: "Ada", email: "ada@example.com" });
    const blocked = await post(s.base, "/api/bookings", { item: "bob-synth", start: isoDaysFromToday(4), blocks: 1, name: "Bo", email: "bo@example.com" });
    assert.equal(blocked.status, 409);

    await admin(s.base, `/api/admin/bookings/${created.data.ref}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });

    const freed = await post(s.base, "/api/bookings", { item: "bob-synth", start: isoDaysFromToday(4), blocks: 1, name: "Bo", email: "bo@example.com" });
    assert.equal(freed.status, 201);
  } finally {
    await s.close();
  }
});

test("owner can update locker and consignment status and see the summary", async () => {
  const s = await startAdmin();
  try {
    await post(s.base, "/api/locker", { units: 2, plan: 29, name: "Ada", email: "ada@example.com" });
    const lockerList = await (await admin(s.base, "/api/admin/locker")).json();
    const lockerId = lockerList.records[0].id;

    const activate = await admin(s.base, `/api/admin/locker/${lockerId}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    assert.equal(activate.status, 200);

    const consign = await post(s.base, "/api/consign", {
      item: "Chestnut", type: "Human hair", condition: "Excellent", price: 500, rate: 30, owner: "Ada", email: "ada@example.com",
    });
    await admin(s.base, `/api/admin/consignments/${consign.data.ref}`, { method: "PATCH", body: JSON.stringify({ status: "sold" }) });

    const summary = await (await admin(s.base, "/api/admin/summary")).json();
    assert.equal(summary.locker.activeUnits, 2);
    assert.equal(summary.locker.monthlyRecurring, 58);
    assert.equal(summary.consignments.sold, 1);
    assert.equal(summary.consignments.total, 1);
  } finally {
    await s.close();
  }
});

test("owner page is served at /owner", async () => {
  const s = await startAdmin();
  try {
    const res = await fetch(s.base + "/owner");
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Owner dashboard/);
  } finally {
    await s.close();
  }
});

test("summary returns zeros, not nulls, on an empty database", async () => {
  const s = await startAdmin();
  try {
    const summary = await (await admin(s.base, "/api/admin/summary")).json();
    assert.deepEqual(summary.bookings, { total: 0, pending: 0, upcoming: 0, revenue: 0, holdsOpen: 0 });
    assert.deepEqual(summary.locker, { activeUnits: 0, monthlyRecurring: 0, pending: 0 });
    assert.deepEqual(summary.consignments, { total: 0, inStore: 0, sold: 0 });
  } finally {
    await s.close();
  }
});
