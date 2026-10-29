(function () {
  "use strict";

  var DAY = 86400000;
  var CATALOG = null;   // loaded from GET /api/catalog; the server is the source of truth for prices
  var selectedItem = null;
  var availabilityRequest = 0;

  function $(id) { return document.getElementById(id); }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

  function api(path, options) {
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || "Request failed. Please try again.");
        return data;
      });
    }, function () {
      throw new Error("We can't reach the booking server right now. Please try again shortly.");
    });
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function formatIso(iso) {
    var p = iso.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  function addDays(iso, n) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * DAY);
    return d.toISOString().slice(0, 10);
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

  // Marks a field valid/invalid. An invalid field gets focus so keyboard and
  // screen-reader users land on it; its error text is linked via aria-describedby.
  function fieldError(input, ok) {
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    if (!ok) input.focus();
    return ok;
  }

  function clearInvalid(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
  }

  // Shows a confirmation inside the form (instead of a pop-up alert) and moves focus to it.
  function showSuccess(id, message) {
    var box = $(id);
    box.textContent = message;
    box.focus();
  }

  function findItem(id) {
    return CATALOG.items.filter(function (i) { return i.id === id; })[0];
  }

  // ----- Catalog -----
  function renderCatalog() {
    var grid = $("catalog");
    var focusedId = document.activeElement && grid.contains(document.activeElement)
      ? document.activeElement.getAttribute("data-id") : null;
    grid.innerHTML = "";
    grid.removeAttribute("aria-busy");
    CATALOG.items.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "card item" + (item.id === selectedItem ? " selected" : "");

      var tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.type;

      var h = document.createElement("h3");
      h.id = "item-" + item.id;
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
      var isSelected = item.id === selectedItem;
      btn.textContent = isSelected ? "\u2713 Selected" : "Select";
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.setAttribute("aria-label", (isSelected ? "Selected: " : "Select ") + item.name);
      btn.setAttribute("data-id", item.id);

      meta.appendChild(price);
      meta.appendChild(btn);
      card.appendChild(tag);
      card.appendChild(h);
      card.appendChild(p);
      card.appendChild(meta);
      grid.appendChild(card);
      if (focusedId === item.id) btn.focus();   // keep keyboard focus after re-rendering
    });
  }

  $("catalog").addEventListener("click", function (e) {
    var target = e.target && e.target.closest ? e.target.closest("[data-id]") : e.target;
    var id = target && target.getAttribute("data-id");
    if (!id) return;
    selectedItem = id;
    $("b-item").value = id;
    renderCatalog();
    updateSummary();
  });

  function initBookingForm() {
    var select = $("b-item");
    select.innerHTML = "";
    CATALOG.items.forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.name + " — " + money(item.price) + "/block";
      select.appendChild(opt);
    });
    select.value = selectedItem;
    $("b-start").min = todayIso();
    $("b-blocks").innerHTML = "";
    for (var n = 1; n <= CATALOG.rules.maxBlocks; n++) {
      var opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = n + (n === 1 ? " block (4 days)" : " blocks (" + (n * 4) + " days)");
      $("b-blocks").appendChild(opt);
    }
  }

  // ----- Booking summary + availability -----
  function bookingInputs() {
    var item = findItem($("b-item").value);
    var blocks = parseInt($("b-blocks").value, 10) || 1;
    var start = $("b-start").value || null;
    var end = start ? addDays(start, blocks * CATALOG.rules.blockDays - 1) : null;
    return { item: item, blocks: blocks, start: start, end: end };
  }

  function updateSummary() {
    var b = bookingInputs();
    var rental = b.item.price * b.blocks;
    $("s-rental").textContent = money(rental);
    $("s-fee").textContent = money(CATALOG.rules.fee);
    $("s-total").textContent = money(rental + CATALOG.rules.fee);
    $("s-hold").textContent = money(b.item.hold);

    var win = $("s-window");
    win.className = "window";
    if (!b.start) {
      win.textContent = "Choose a start date to check availability.";
      return;
    }
    win.textContent = "Checking availability…";

    var requestId = ++availabilityRequest;
    var url = "/api/availability?item=" + encodeURIComponent(b.item.id) + "&start=" + b.start + "&blocks=" + b.blocks;
    api(url).then(function (data) {
      if (requestId !== availabilityRequest) return;   // a newer request has replaced this one
      if (data.reason === "past") {
        win.textContent = "Start date must be today or later.";
        win.className = "window bad";
      } else if (!data.available) {
        win.textContent = "That item is not available for those dates, including the 4-day turnaround buffer. Try another start date.";
        win.className = "window bad";
      } else {
        win.textContent = "Available " + formatIso(data.start) + " – " + formatIso(data.end) + ".";
        win.className = "window ok";
      }
    }).catch(function (err) {
      if (requestId !== availabilityRequest) return;
      win.textContent = err.message;
      win.className = "window bad";
    });
  }

  $("b-item").addEventListener("change", function () {
    selectedItem = $("b-item").value;
    renderCatalog();
    updateSummary();
  });
  ["b-start", "b-blocks"].forEach(function (id) {
    $(id).addEventListener("change", updateSummary);
  });

  $("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("b-error");
    var name = $("b-name").value.trim();
    var email = $("b-email").value.trim();
    var b = bookingInputs();
    clearInvalid($("booking-form"));
    $("b-success").textContent = "";

    if (!fieldError($("b-start"), !!b.start)) { err.textContent = "Choose a start date."; return; }
    if (!fieldError($("b-name"), name.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("b-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    err.textContent = "";
    var submit = $("booking-form").querySelector("button[type=submit]");
    submit.disabled = true;

    api("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: b.item.id, start: b.start, blocks: b.blocks, name: name, email: email }),
    }).then(function (data) {
      $("booking-form").reset();
      $("b-item").value = selectedItem;
      updateSummary();
      showSuccess("b-success", "Booking request " + data.ref + " received for " + formatIso(data.start) + " – " + formatIso(data.end) + "." +
        (data.emailed ? " A confirmation was sent to " + email + "." : " We will email " + email + " to confirm."));
    }).catch(function (error) {
      err.textContent = error.message;
      updateSummary();
    }).then(function () {
      submit.disabled = false;
    });
  });

  // ----- Wig Locker -----
  function updateLocker() {
    var units = Math.max(1, Math.min(CATALOG.rules.maxUnits, parseInt($("l-units").value, 10) || 1));
    var rate = parseInt($("l-plan").value, 10);
    var plan = CATALOG.rules.lockerPlans[rate];
    $("l-total").textContent = money(units * rate) + " / month";
    $("l-note").textContent = units + " unit" + (units === 1 ? "" : "s") + " on the " + plan + " plan. Includes a monthly brush and dust cube per unit.";
  }
  ["l-units", "l-plan"].forEach(function (id) {
    $(id).addEventListener("input", updateLocker);
    $(id).addEventListener("change", updateLocker);
  });

  $("locker-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("l-error");
    var name = $("l-name").value.trim();
    var email = $("l-email").value.trim();
    var units = parseInt($("l-units").value, 10);
    clearInvalid($("locker-form"));
    $("l-success").textContent = "";
    if (!fieldError($("l-units"), units >= 1 && units <= CATALOG.rules.maxUnits)) { err.textContent = "Units must be between 1 and " + CATALOG.rules.maxUnits + "."; return; }
    if (!fieldError($("l-name"), name.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("l-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    err.textContent = "";
    api("/api/locker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: units, plan: $("l-plan").value, name: name, email: email }),
    }).then(function (data) {
      $("locker-form").reset();
      $("l-units").value = 2;
      $("l-plan").value = "29";
      updateLocker();
      showSuccess("l-success", "Locker reservation received for " + money(data.monthly) + " / month." +
        (data.emailed ? " A confirmation was sent to " + email + "." : " We will email " + email + " with your intake instructions."));
    }).catch(function (error) {
      err.textContent = error.message;
    });
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
  ["c-price", "c-rate"].forEach(function (id) {
    $(id).addEventListener("input", updateConsign);
    $(id).addEventListener("change", updateConsign);
  });

  $("consign-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("c-error");
    var itemName = $("c-name").value.trim();
    var owner = $("c-owner").value.trim();
    var email = $("c-email").value.trim();
    var price = parseFloat($("c-price").value);
    clearInvalid($("consign-form"));
    $("c-success").textContent = "";
    if (!fieldError($("c-name"), itemName.length > 0)) { err.textContent = "Enter the item name."; return; }
    if (!fieldError($("c-price"), price > 0)) { err.textContent = "Enter an asking price above zero."; return; }
    if (!fieldError($("c-owner"), owner.length > 0)) { err.textContent = "Enter your name."; return; }
    if (!fieldError($("c-email"), validEmail(email))) { err.textContent = "Enter a valid email address."; return; }

    err.textContent = "";
    api("/api/consign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: itemName,
        type: $("c-type").value,
        condition: $("c-condition").value,
        price: price,
        rate: parseInt($("c-rate").value, 10),
        owner: owner,
        email: email,
      }),
    }).then(function (data) {
      $("consign-form").reset();
      $("c-price").value = 400;
      $("c-rate").value = "30";
      $("c-condition").selectedIndex = 1;
      updateConsign();
      showSuccess("c-success", "Thanks! Reference " + data.ref + " received for " + itemName + "." +
        (data.emailed ? " A confirmation was sent to " + email + "." : " We will email " + email + " with shipping instructions."));
    }).catch(function (error) {
      err.textContent = error.message;
    });
  });

  // ----- Init -----
  $("year").textContent = new Date().getFullYear();
  updateConsign();

  api("/api/catalog").then(function (data) {
    CATALOG = data;
    selectedItem = CATALOG.items[0].id;
    initBookingForm();
    renderCatalog();
    updateSummary();
    updateLocker();
  }).catch(function (error) {
    $("catalog").removeAttribute("aria-busy");
    $("catalog").textContent = error.message;
    $("s-window").textContent = error.message;
    $("s-window").className = "window bad";
  });
})();
