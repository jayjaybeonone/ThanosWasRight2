(function () {
  "use strict";

  // Sample inventory. Replace with real units when they are onboarded.
  var ITEMS = [
    { id: "chestnut-lace", name: "Chestnut Layered Lace Front", type: "Human hair", price: 280, hold: 350, blurb: "Long, layered, mid-density. Hand-tied lace." },
    { id: "bob-synth", name: "Heat-Resistant Synthetic Bob", type: "Synthetic", price: 65, hold: 150, blurb: "Sleek bob with a soft fringe. Heat-safe to 180°C." },
    { id: "platinum-glueless", name: "Platinum Glueless Wavy", type: "Glueless", price: 150, hold: 250, blurb: "Glueless cap, no adhesive. Easy to put on and take off." },
    { id: "silver-pixie", name: "Silver Pixie Crop", type: "Character ready", price: 80, hold: 200, blurb: "Short, textured cut for stage and character looks." },
    { id: "jet-waist", name: "Jet Black Waist-Length", type: "Stage & drag", price: 120, hold: 200, blurb: "Waist-length straight fibers for performance." },
    { id: "espresso-curly", name: "Espresso Curly Glueless", type: "Human hair", price: 240, hold: 300, blurb: "Defined curls, glueless cap, medium density." }
  ];

  var BLOCK_DAYS = 4;          // one rental block
  var BUFFER_DAYS = 4;         // turnaround buffer between bookings
  var FEE = 25;                // shipping, return label, and hygiene fee (placeholder)
  var DAY = 86400000;
  var PLAN_NAMES = { 19: "Essentials", 29: "Standard", 39: "Premier" };
  var STORE = { bookings: "atelier.bookings", locker: "atelier.locker", consign: "atelier.consign" };

  function $(id) { return document.getElementById(id); }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

  // localStorage can be blocked (private mode), so every access is guarded.
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
  }
  function write(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
  }

  // Parse YYYY-MM-DD as a local date and return a day number, so timezones do not shift results.
  function dayNumber(str) {
    var p = str.split("-");
    return Math.round(new Date(+p[0], +p[1] - 1, +p[2]).getTime() / DAY);
  }
  function todayNumber() {
    var d = new Date();
    return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY);
  }
  function formatDay(n) {
    return new Date(n * DAY).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  // Each booking occupies its days plus the turnaround buffer on both sides.
  function conflicts(itemId, start, end) {
    return read(STORE.bookings).some(function (b) {
      if (b.item !== itemId) return false;
      return start <= b.end + BUFFER_DAYS && end >= b.start - BUFFER_DAYS;
    });
  }

  // ----- Catalog -----
  var selectedItem = ITEMS[0].id;

  function renderCatalog() {
    var grid = $("catalog");
    grid.innerHTML = "";
    ITEMS.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "card item" + (item.id === selectedItem ? " selected" : "");

      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.type;

      var h = document.createElement("h3");
      h.textContent = item.name;

      var p = document.createElement("p");
      p.textContent = item.blurb;

      var meta = document.createElement("div");
      meta.className = "meta";
      var price = document.createElement("span");
      price.className = "price";
      price.textContent = money(item.price) + " / block";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost btn-small";
      btn.textContent = item.id === selectedItem ? "Selected" : "Select";
      btn.setAttribute("data-id", item.id);

      meta.appendChild(price);
      meta.appendChild(btn);
      card.appendChild(tag);
      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  $("catalog").addEventListener("click", function (e) {
    var id = e.target && e.target.getAttribute("data-id");
    if (!id) return;
    selectedItem = id;
    $("b-item").value = id;
    renderCatalog();
    updateSummary();
  });

  // Fill the wig dropdown and set the minimum start date to today.
  (function initBookingForm() {
    var select = $("b-item");
    ITEMS.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.name + " — " + money(item.price) + "/block";
      select.appendChild(opt);
    });
    select.value = selectedItem;
    var today = new Date();
    var iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    $("b-start").min = iso;
  })();

  // ----- Booking summary -----
  function bookingInputs() {
    var item = ITEMS.filter(function (i) { return i.id === $("b-item").value; })[0];
    var blocks = parseInt($("b-blocks").value, 10) || 1;
    var startStr = $("b-start").value;
    var start = startStr ? dayNumber(startStr) : null;
    var end = start === null ? null : start + blocks * BLOCK_DAYS - 1;
    return { item: item, blocks: blocks, start: start, end: end };
  }

  function updateSummary() {
    var b = bookingInputs();
    var rental = b.item.price * b.blocks;
    $("s-rental").textContent = money(rental);
    $("s-fee").textContent = money(FEE);
    $("s-total").textContent = money(rental + FEE);
    $("s-hold").textContent = money(b.item.hold);

    var win = $("s-window");
    win.className = "window";
    if (b.start === null) {
      win.textContent = "Choose a start date to check availability.";
    } else if (b.start < todayNumber()) {
      win.textContent = "Start date must be today or later.";
      win.className = "window bad";
    } else if (conflicts(b.item.id, b.start, b.end)) {
      win.textContent = "That item is not available for those dates, including the 4-day turnaround buffer. Try another start date.";
      win.className = "window bad";
    } else {
      win.textContent = "Available " + formatDay(b.start) + " – " + formatDay(b.end) + ".";
      win.className = "window ok";
    }
  }

  $("b-item").addEventListener("change", function () {
    selectedItem = $("b-item").value;
    renderCatalog();
    updateSummary();
  });
  ["b-start", "b-blocks"].forEach(function (id) {
    $(id).addEventListener("change", updateSummary);
  });

  function fieldError(input, ok) {
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    return ok;
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

  $("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("b-error");
    var b = bookingInputs();
    var name = $("b-name").value.trim();
    var email = $("b-email").value.trim();

    if (!fieldError($("b-start"), b.start !== null && b.start >= todayNumber())) {
      err.textContent = "Choose a start date today or later.";
      return;
    }
    if (conflicts(b.item.id, b.start, b.end)) {
      err.textContent = "That item is not available for those dates. Please pick another start date.";
      return;
    }
    if (!fieldError($("b-name"), name.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("b-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    var list = read(STORE.bookings);
    list.push({
      ref: "BK-" + Date.now().toString(36).toUpperCase(),
      item: b.item.id,
      start: b.start,
      end: b.end,
      blocks: b.blocks,
      name: name,
      email: email,
      total: b.item.price * b.blocks + FEE,
      hold: b.item.hold,
      created: new Date().toISOString()
    });
    write(STORE.bookings, list);

    err.textContent = "";
    $("booking-form").reset();
    $("b-item").value = selectedItem;
    updateSummary();
    alert("Booking request received for " + b.item.name + " (" + formatDay(b.start) + " – " + formatDay(b.end) + "). We will email " + email + " to confirm.");
  });

  // ----- Wig Locker -----
  function updateLocker() {
    var units = Math.max(1, Math.min(50, parseInt($("l-units").value, 10) || 1));
    var rate = parseInt($("l-plan").value, 10);
    var plan = PLAN_NAMES[rate];
    $("l-total").textContent = money(units * rate) + " / month";
    $("l-note").textContent = units + " unit" + (units === 1 ? "" : "s") + " on the " + plan + " plan. Includes a monthly brush and dust cube per unit.";
  }
  ["l-units", "l-plan"].forEach(function (id) { $(id).addEventListener("input", updateLocker); $(id).addEventListener("change", updateLocker); });

  $("locker-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("l-error");
    var name = $("l-name").value.trim();
    var email = $("l-email").value.trim();
    var units = parseInt($("l-units").value, 10);
    if (!fieldError($("l-units"), units >= 1 && units <= 50)) { err.textContent = "Units must be between 1 and 50."; return; }
    if (!fieldError($("l-name"), name.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("l-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    var list = read(STORE.locker);
    list.push({ units: units, rate: parseInt($("l-plan").value, 10), name: name, email: email, created: new Date().toISOString() });
    write(STORE.locker, list);

    err.textContent = "";
    $("locker-form").reset();
    $("l-units").value = 2;
    $("l-plan").value = "29";
    updateLocker();
    alert("Locker reservation received. We will email " + email + " with your intake instructions.");
  });

  // ----- Consignment -----
  function updateConsign() {
    var price = Math.max(0, parseFloat($("c-price").value) || 0);
    var rate = parseInt($("c-rate").value, 10) / 100;
    var fee = price * rate;
    $("c-sale").textContent = money(price);
    $("c-fee").textContent = "−" + money(fee);
    $("c-payout").textContent = money(price - fee);
  }
  ["c-price", "c-rate"].forEach(function (id) { $(id).addEventListener("input", updateConsign); $(id).addEventListener("change", updateConsign); });

  $("consign-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("c-error");
    var itemName = $("c-name").value.trim();
    var owner = $("c-owner").value.trim();
    var email = $("c-email").value.trim();
    var price = parseFloat($("c-price").value);
    if (!fieldError($("c-name"), itemName.length > 0)) { err.textContent = "Enter the item name."; return; }
    if (!fieldError($("c-price"), price > 0)) { err.textContent = "Enter an asking price above zero."; return; }
    if (!fieldError($("c-owner"), owner.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("c-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    var list = read(STORE.consign);
    list.push({
      ref: "CS-" + Date.now().toString(36).toUpperCase(),
      item: itemName,
      type: $("c-type").value,
      condition: $("c-condition").value,
      price: price,
      rate: parseInt($("c-rate").value, 10),
      owner: owner,
      email: email,
      created: new Date().toISOString()
    });
    write(STORE.consign, list);

    err.textContent = "";
    $("consign-form").reset();
    $("c-price").value = 400;
    $("c-rate").value = "30";
    $("c-condition").selectedIndex = 1;
    updateConsign();
    alert("Thanks! We received " + itemName + ". We will email " + email + " with shipping instructions after the inspection is scheduled.");
  });

  // ----- Init -----
  $("year").textContent = new Date().getFullYear();
  renderCatalog();
  updateSummary();
  updateLocker();
  updateConsign();
})();
