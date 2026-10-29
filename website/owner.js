(function () {
  "use strict";

  var TOKEN_KEY = "atelier.ownerToken";   // kept for this tab only (sessionStorage)
  var STATUS_OPTIONS = {
    bookings: ["pending", "confirmed", "out", "returned", "cancelled"],
    locker: ["pending", "active", "ended"],
    consignments: ["received", "listed", "sold", "paid_out", "returned"],
  };
  var ENDPOINTS = { bookings: "/api/admin/bookings", locker: "/api/admin/locker", consignments: "/api/admin/consignments" };
  var state = { tab: "bookings", records: [], token: null };

  function $(id) { return document.getElementById(id); }
  function money(n) { return "$" + Math.round(n || 0).toLocaleString("en-US"); }
  function label(status) { return String(status).replace(/_/g, " "); }

  function storedToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function saveToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) { /* storage unavailable: token is kept in memory only */ }
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  // Calls the owner API. A 401 signs the owner out so a wrong token doesn't stick.
  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ Authorization: "Bearer " + state.token }, options.headers || {});
    return fetch(path, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.status === 401) { signOut("Your owner token was not accepted."); throw new Error("Not signed in."); }
        if (!res.ok) throw new Error(data.error || "Request failed. Please try again.");
        return data;
      });
    }, function () {
      throw new Error("We can't reach the server right now.");
    });
  }

  function showView(name) {
    $("login").hidden = name !== "login";
    $("dashboard").hidden = name !== "dashboard";
    $("sign-out").hidden = name !== "dashboard";
  }

  function signOut(message) {
    state.token = null;
    clearToken();
    showView("login");
    $("login-error").textContent = message || "";
    $("token").value = "";
  }

  // ----- Sign in -----
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var token = $("token").value.trim();
    if (!token) { $("login-error").textContent = "Enter the owner token."; return; }
    state.token = token;
    $("login-error").textContent = "";
    load(true);
  });

  $("sign-out").addEventListener("click", function () { signOut(); });

  // ----- Stats -----
  function renderStats(s) {
    var cards = [
      { label: "Upcoming rentals", value: s.bookings.upcoming, note: s.bookings.pending + " awaiting confirmation" },
      { label: "Rental revenue", value: money(s.bookings.revenue), note: "excludes cancelled" },
      { label: "Security holds open", value: money(s.bookings.holdsOpen), note: "authorized, not charged" },
      { label: "Locker units active", value: s.locker.activeUnits, note: money(s.locker.monthlyRecurring) + " / month" },
      { label: "Pending locker requests", value: s.locker.pending, note: "needs intake" },
      { label: "Consignments in store", value: s.consignments.inStore, note: s.consignments.sold + " sold so far" },
    ];
    var grid = $("stats");
    grid.innerHTML = "";
    cards.forEach(function (c) {
      var card = document.createElement("div");
      card.className = "card stat";
      var v = document.createElement("strong");
      v.textContent = String(c.value);
      var l = document.createElement("span");
      l.className = "stat-label";
      l.textContent = c.label;
      var n = document.createElement("span");
      n.className = "muted small";
      n.textContent = c.note;
      card.appendChild(l);
      card.appendChild(v);
      card.appendChild(n);
      grid.appendChild(card);
    });
  }

  // ----- Tables -----
  var COLUMNS = {
    bookings: [
      { key: "ref", title: "Reference" },
      { key: "name", title: "Customer", sub: "email" },
      { key: "itemName", title: "Wig" },
      { key: "dates", title: "Dates" },
      { key: "total", title: "Total", money: true },
      { key: "hold", title: "Hold", money: true },
      { key: "status", title: "Status", status: true },
    ],
    locker: [
      { key: "id", title: "#" },
      { key: "name", title: "Customer", sub: "email" },
      { key: "units", title: "Units" },
      { key: "plan_rate", title: "Monthly", money: true, perUnit: true },
      { key: "status", title: "Status", status: true },
    ],
    consignments: [
      { key: "ref", title: "Reference" },
      { key: "owner", title: "Owner", sub: "email" },
      { key: "item", title: "Item", sub: "hair_type" },
      { key: "price", title: "Asking", money: true },
      { key: "rate", title: "Commission", suffix: "%" },
      { key: "status", title: "Status", status: true },
    ],
  };
  var KEY_FIELD = { bookings: "ref", locker: "id", consignments: "ref" };

  function formatDates(r) {
    function fmt(iso) {
      var p = iso.split("-");
      return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
    return fmt(r.start) + " – " + fmt(r.end);
  }

  function cellText(row, col) {
    if (col.key === "dates") return formatDates(row);
    var v = row[col.key];
    if (col.money) return money(col.perUnit ? v * row.units : v) + (col.perUnit ? " / month" : "");
    if (col.suffix) return v + col.suffix;
    return v;
  }

  function renderTable() {
    var tab = state.tab;
    var cols = COLUMNS[tab];
    var filter = $("status-filter").value;
    var rows = state.records.filter(function (r) { return !filter || r.status === filter; });

    $("count").textContent = rows.length + " record" + (rows.length === 1 ? "" : "s");

    var head = $("table-head");
    head.innerHTML = "";
    var tr = document.createElement("tr");
    cols.forEach(function (c) {
      var th = document.createElement("th");
      th.textContent = c.title;
      tr.appendChild(th);
    });
    head.appendChild(tr);

    var body = $("table-body");
    body.innerHTML = "";
    if (!rows.length) {
      var empty = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = cols.length;
      td.className = "muted";
      td.textContent = "Nothing here yet.";
      empty.appendChild(td);
      body.appendChild(empty);
      return;
    }

    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      cols.forEach(function (col) {
        var td = document.createElement("td");
        if (col.status) {
          td.appendChild(statusControl(tab, row));
        } else if (col.sub) {
          var main = document.createElement("div");
          main.textContent = cellText(row, col);
          var sub = document.createElement("div");
          sub.className = "muted small";
          sub.textContent = row[col.sub] || "";
          td.appendChild(main);
          td.appendChild(sub);
        } else {
          td.textContent = cellText(row, col);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }

  // A status dropdown that saves immediately when changed.
  function statusControl(tab, row) {
    var wrap = document.createElement("div");
    wrap.className = "status-cell";
    var select = document.createElement("select");
    select.setAttribute("aria-label", "Status");
    STATUS_OPTIONS[tab].forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = label(s);
      if (s === row.status) opt.selected = true;
      select.appendChild(opt);
    });
    var note = document.createElement("span");
    note.className = "small muted";
    select.addEventListener("change", function () {
      var newStatus = select.value;
      var key = row[KEY_FIELD[tab]];
      note.textContent = "Saving…";
      api(ENDPOINTS[tab] + "/" + encodeURIComponent(key), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      }).then(function () {
        row.status = newStatus;
        note.textContent = "Saved";
        setTimeout(function () { note.textContent = ""; }, 1500);
        renderTable();
        loadSummary();
      }).catch(function (err) {
        note.textContent = "";
        $("table-error").textContent = err.message;
        select.value = row.status;
      });
    });
    wrap.appendChild(select);
    wrap.appendChild(note);
    return wrap;
  }

  function setupFilter(tab) {
    var select = $("status-filter");
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = "All statuses";
    select.appendChild(all);
    STATUS_OPTIONS[tab].forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = label(s);
      select.appendChild(opt);
    });
  }

  // ----- Loading -----
  function loadSummary() {
    return api("/api/admin/summary").then(renderStats);
  }

  function loadTable() {
    var tab = state.tab;
    return api(ENDPOINTS[tab]).then(function (data) {
      state.records = data.records;
      renderTable();
    });
  }

  function load(fromSignIn) {
    $("table-error").textContent = "";
    $("updated").textContent = "Loading…";
    Promise.all([loadSummary(), loadTable()]).then(function () {
      if (fromSignIn) saveToken(state.token);
      showView("dashboard");
      $("updated").textContent = "Updated " + new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }).catch(function (err) {
      if (state.token === null) return;   // signed out by a 401; the message is already shown
      if (fromSignIn) {
        $("login-error").textContent = err.message;
        return;
      }
      $("table-error").textContent = err.message;
    });
  }

  // ----- Tabs and filters -----
  document.querySelectorAll(".tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
      });
      setupFilter(state.tab);
      loadTable();
    });
  });

  $("status-filter").addEventListener("change", renderTable);
  $("refresh").addEventListener("click", function () { load(false); });

  // ----- Init -----
  setupFilter("bookings");
  var saved = storedToken();
  if (saved) {
    state.token = saved;
    load(false);
  } else {
    showView("login");
  }
})();
