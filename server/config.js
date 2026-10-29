"use strict";

// Source of truth for prices and rules. The browser loads these from GET /api/catalog,
// so prices are never trusted from the client.

const ITEMS = [
  { id: "chestnut-lace", name: "Chestnut Layered Lace Front", type: "Human hair", price: 280, hold: 350, blurb: "Long, layered, mid-density. Hand-tied lace." },
  { id: "bob-synth", name: "Heat-Resistant Synthetic Bob", type: "Synthetic", price: 65, hold: 150, blurb: "Sleek bob with a soft fringe. Heat-safe to 180°C." },
  { id: "platinum-glueless", name: "Platinum Glueless Wavy", type: "Glueless", price: 150, hold: 250, blurb: "Glueless cap, no adhesive. Easy to put on and take off." },
  { id: "silver-pixie", name: "Silver Pixie Crop", type: "Character ready", price: 80, hold: 200, blurb: "Short, textured cut for stage and character looks." },
  { id: "jet-waist", name: "Jet Black Waist-Length", type: "Stage & drag", price: 120, hold: 200, blurb: "Waist-length straight fibers for performance." },
  { id: "espresso-curly", name: "Espresso Curly Glueless", type: "Human hair", price: 240, hold: 300, blurb: "Defined curls, glueless cap, medium density." },
];

const RULES = {
  blockDays: 4,       // one rental block
  bufferDays: 4,      // turnaround buffer on both sides of a booking
  maxBlocks: 3,
  fee: 25,            // shipping, return label, and hygiene fee (placeholder)
  lockerPlans: { 19: "Essentials", 29: "Standard", 39: "Premier" },
  maxUnits: 50,
  commissionRates: [20, 25, 30, 35],
};

module.exports = { ITEMS, RULES };
