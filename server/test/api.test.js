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
