/* FoodOps — demand-test demo. localStorage only. */
"use strict";

/* ================= CONFIG ================= */
const VENUE = "Bay Bean Café, Tauranga";
const STORE_KEY = "foodops_v1";
const SIGNUP_BLOB = "https://jsonblob.com/api/jsonBlob/019fab16-68d6-7792-86c8-38e4f633527f";

const UNITS = [
  { id: "main-fridge",     name: "Main Fridge",     min: 2,   max: 5,  icon: "🧊" },
  { id: "chest-freezer",   name: "Chest Freezer",   min: -18, max: -15, icon: "❄️" },
  { id: "display-chiller", name: "Display Chiller", min: 2,   max: 5,  icon: "🥐" },
  { id: "hot-hold",        name: "Hot Hold",        min: 63,  max: 90, icon: "🔥" },
];

const ACTIONS = [
  { id: "moved-stock",   label: "Moved stock to another unit" },
  { id: "thermostat",    label: "Adjusted thermostat" },
  { id: "discarded",     label: "Discarded stock" },
  { id: "technician",    label: "Called technician" },
];

const OPENING = ["Fridge & freezer temps checked", "Hand-wash station stocked", "Food covered, labelled & dated", "Sanitiser made up fresh"];
const CLOSING = ["Hot hold emptied, food cooled fast", "Benches cleaned & sanitised", "Stock rotated (oldest to front)", "Rubbish out & bins clean"];

/* ================= STORE ================= */
let DB = null;

function loadDB() {
  try { DB = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { DB = null; }
  if (!DB || !DB.entries) { DB = seedData(); saveDB(); }
}
function saveDB() { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }

function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function at(d, h, min) { const x = new Date(d); x.setHours(h, min, 0, 0); return x; }
function fmtTime(ts) {
  const d = new Date(ts); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${m}${ap}`;
}
function fmtDay(key) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDayLong(key) {
  const d = new Date(key + "T12:00:00");
  return d.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function unitById(id) { return UNITS.find(u => u.id === id); }
function inRange(u, t) { return t >= u.min && t <= u.max; }
function fmtTemp(t) { return `${t}°C`; }
function actionLabel(id) { const a = ACTIONS.find(a => a.id === id); return a ? a.label : id; }

/* ================= SEED DATA ================= */
function seedData() {
  const entries = [];
  const checklists = {};
  let idc = 1;
  const mk = (unitId, dayOffset, h, m, temp, action, note) => {
    const u = unitById(unitId);
    const ts = at(daysAgo(dayOffset), h, m).getTime();
    entries.push({
      id: "s" + (idc++), unitId, temp, ts,
      ok: inRange(u, temp),
      action: action || null, note: note || null, seeded: true,
    });
  };
  // deterministic "realistic" temps per unit
  const plan = {
    "main-fridge":     [3.5, 4.1, 3.2, 4.6, 3.8, 4.0, 3.4, 4.4, 3.9, 3.1, 4.2, 3.6],
    "chest-freezer":   [-17.5, -16.8, -17.2, -16.1, -17.8, -16.5, -17.0, -16.3, -17.4, -16.9, -17.1, -16.6],
    "display-chiller": [4.2, 4.8, 3.9, 4.5, 3.6, 4.9, 4.1, 3.8, 4.4, 4.7, 3.5, 4.3],
    "hot-hold":        [68, 71, 66, 74, 69, 72, 65, 70, 67, 73, 71, 68],
  };
  // 7 full past days (offsets 7..1), morning ~8am and afternoon ~3pm
  let pi = 0;
  for (let off = 7; off >= 1; off--) {
    for (const u of UNITS) {
      const tempsForUnit = plan[u.id];
      const tm = tempsForUnit[(pi) % tempsForUnit.length];
      const ta = tempsForUnit[(pi + 5) % tempsForUnit.length];
      // Out-of-range event #1: Main Fridge warm 3 days ago, afternoon — stock moved
      if (u.id === "main-fridge" && off === 3) {
        mk(u.id, off, 8, 5 + off, tm);
        mk(u.id, off, 15, 12, 8.2, "moved-stock", "Door left ajar over lunch rush. Moved dairy to display chiller, rechecked 30 min later: 4.1°C.");
        continue;
      }
      // Out-of-range event #2: Hot Hold cool 5 days ago, morning — thermostat adjusted
      if (u.id === "hot-hold" && off === 5) {
        mk(u.id, off, 8, 20 + off, 58, "thermostat", "Element slow to heat after cleaning. Turned up, verified 66°C at 9:05am.");
        mk(u.id, off, 9, 5, 66);
        mk(u.id, off, 15, 30, ta);
        continue;
      }
      mk(u.id, off, 8, (u.id.length + off * 3) % 50, tm);
      mk(u.id, off, 15, (u.id.length * 2 + off * 7) % 55, ta);
      pi++;
    }
    const k = dateKey(daysAgo(off));
    // one honest gap: 6 days ago the closing checklist was never finished
    checklists[k] = {
      opening: [true, true, true, true],
      closing: off === 6 ? [true, false, false, false] : [true, true, true, true],
    };
  }
  // Today: morning reading on Main Fridge only; opening checklist 3/4
  mk("main-fridge", 0, 8, 10, 3.7);
  checklists[dateKey(new Date())] = { opening: [true, true, true, false], closing: [false, false, false, false] };
  entries.sort((a, b) => a.ts - b.ts);
  return { entries, checklists, localSignups: [], seededAt: Date.now() };
}

function resetDemo() {
  DB = seedData(); saveDB();
  toast("Demo data reset", "ok");
  route();
}

/* ================= QUERIES ================= */
function entriesForDay(key) {
  return DB.entries.filter(e => dateKey(new Date(e.ts)) === key).sort((a, b) => b.ts - a.ts);
}
function unitLoggedToday(unitId) {
  const k = dateKey(new Date());
  return DB.entries.filter(e => e.unitId === unitId && dateKey(new Date(e.ts)) === k);
}
function checklistFor(key) {
  if (!DB.checklists[key]) DB.checklists[key] = { opening: OPENING.map(() => false), closing: CLOSING.map(() => false) };
  return DB.checklists[key];
}

/* ================= ROUTER ================= */
const app = document.getElementById("app");
window.addEventListener("hashchange", route);

function route() {
  const h = location.hash || "#today";
  document.body.classList.remove("printing-pack");
  window.scrollTo(0, 0);
  if (h.startsWith("#log/")) return renderLog(h.slice(5));
  if (h === "#history") return renderHistory();
  if (h === "#pack") return renderPack();
  if (h === "#signups") return renderSignups();
  return renderToday();
}

function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

let toastTimer = null;
function toast(msg, kind) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast show " + (kind || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 2600);
}

/* ================= TODAY ================= */
function renderToday() {
  const todayKey = dateKey(new Date());
  const cl = checklistFor(todayKey);
  const openDone = cl.opening.filter(Boolean).length;
  const closeDone = cl.closing.filter(Boolean).length;
  const dateStr = new Date().toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" });

  const unitCards = UNITS.map(u => {
    const logs = unitLoggedToday(u.id);
    const last = logs[0];
    const hasBad = logs.some(e => !e.ok);
    let dot, meta;
    if (!last) { dot = '<div class="status-dot todo">–</div>'; meta = `Not logged today · range ${u.min} to ${u.max}°C`; }
    else if (hasBad && !logs.some(e => e.ok && e.ts > Math.max(...logs.filter(x => !x.ok).map(x => x.ts)))) {
      dot = '<div class="status-dot alert">!</div>'; meta = `${fmtTemp(last.temp)} at ${fmtTime(last.ts)} — action recorded`;
    } else { dot = '<div class="status-dot done">✓</div>'; meta = `${fmtTemp(last.temp)} at ${fmtTime(last.ts)}`; }
    return `<button class="unit-card" data-nav="#log/${u.id}" aria-label="Log ${esc(u.name)}">
      ${dot}
      <div><div class="u-name">${u.icon} ${esc(u.name)}</div><div class="u-meta">${esc(meta)}</div></div>
      <div class="chev">›</div>
    </button>`;
  }).join("");

  const clCard = (title, items, arr, which) => `
    <div class="check-card" id="cc-${which}">
      <button class="ch-head" style="width:100%;background:none;border:none;padding:0;" data-togglecl="${which}">
        <span>${title}</span>
        <span class="ch-prog ${arr.filter(Boolean).length === arr.length ? "all" : ""}">${arr.filter(Boolean).length}/${arr.length} ${arr.filter(Boolean).length === arr.length ? "✓" : ""}</span>
      </button>
      <div class="check-items">
        ${items.map((it, i) => `<button class="check-item ${arr[i] ? "done" : ""}" data-check="${which}:${i}">
          <span class="box">${arr[i] ? "✓" : ""}</span><span>${esc(it)}</span></button>`).join("")}
      </div>
    </div>`;

  app.innerHTML = `
  <div class="screen">
    <div class="venue-head">
      <h1>${esc(VENUE)}</h1>
      <div class="date">${esc(dateStr)}</div>
    </div>
    <div class="trial-banner">Early trial — keep your paper records going too while you try this.</div>
    <button class="pack-btn" data-nav="#pack">
      <span style="font-size:1.6rem">📋</span>
      <span>Verification Pack<span class="sub">Audit-ready records in one tap</span></span>
    </button>
    <div class="section-label">Temperature checks</div>
    ${unitCards}
    <div class="section-label">Checklists</div>
    ${clCard("Opening checklist", OPENING, cl.opening, "opening")}
    ${clCard("Closing checklist", CLOSING, cl.closing, "closing")}
    <div class="bottom-links">
      <button class="flat-btn" data-nav="#history">🗓 History</button>
      <button class="flat-btn" data-nav="#pack">📋 Verification Pack</button>
    </div>
    <div class="footer-tools">
      <button data-act="reset">Reset demo data</button>
    </div>
  </div>
  <button class="pilot-btn" data-act="pilot">Join the pilot</button>`;
  wire();
}

/* ================= LOG ENTRY ================= */
let logState = null;

function renderLog(unitId) {
  const u = unitById(unitId);
  if (!u) { location.hash = "#today"; return; }
  logState = { unitId, str: "", action: null, note: "" };
  drawLog(u);
}

function currentTemp() {
  if (!logState.str || logState.str === "-" || logState.str === "." || logState.str === "-.") return null;
  const v = parseFloat(logState.str);
  return isNaN(v) ? null : v;
}

function drawLog(u) {
  const t = currentTemp();
  const has = t !== null;
  const ok = has ? inRange(u, t) : null;
  const needsCA = has && !ok;
  const canSave = has && (ok || logState.action);

  app.innerHTML = `
  <div class="screen">
    <div class="log-head">
      <button class="back-btn" data-nav="#today">‹ Back</button>
      <div>
        <h2 class="log-title">${u.icon} ${esc(u.name)}</h2>
        <div class="log-range">Safe range: ${u.min} to ${u.max}°C</div>
      </div>
    </div>
    <div class="temp-display ${has ? (ok ? "ok" : "bad") : ""}" id="tempDisplay">
      <div class="val">${has || logState.str ? esc(logState.str) : '<span style="color:#b8bec3">— °C</span>'}${has || logState.str ? '<span class="unit-c">°C</span>' : ""}</div>
      <div class="verdict">${has ? (ok ? "✓ In range" : "✗ OUT OF RANGE") : "Enter the temperature"}</div>
    </div>
    <div class="voice-row">
      <button class="voice-btn" id="voiceBtn"><span style="font-size:1.4rem">🎤</span> Say the temperature</button>
    </div>
    ${needsCA ? `
    <div class="ca-block">
      <h3>⚠ Corrective action required</h3>
      <p>This reading is outside the safe range. You must record what you did about it — it cannot be saved otherwise.</p>
      ${ACTIONS.map(a => `<button class="ca-opt ${logState.action === a.id ? "sel" : ""}" data-ca="${a.id}">
        <span>${logState.action === a.id ? "●" : "○"}</span><span>${esc(a.label)}</span></button>`).join("")}
      <input class="ca-note" id="caNote" placeholder="Optional note (what, when, rechecked?)" value="${esc(logState.note)}">
    </div>` : ""}
    <div class="pad">
      ${[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => `<button data-key="${n}">${n}</button>`).join("")}
      <button data-key="-" class="fn">+/−</button>
      <button data-key="0">0</button>
      <button data-key="." class="fn">·</button>
      <button data-key="del" class="fn" style="grid-column:span 3">⌫ delete</button>
    </div>
    <button class="save-btn ${needsCA ? "danger" : ""}" id="saveBtn" ${canSave ? "" : "disabled"}>
      ${!has ? "Save" : ok ? "✓ Save reading" : logState.action ? "Save with corrective action" : "Choose a corrective action first"}
    </button>
  </div>`;
  wire();

  // number pad
  app.querySelectorAll("[data-key]").forEach(b => b.addEventListener("click", () => {
    const k = b.getAttribute("data-key");
    if (k === "del") logState.str = logState.str.slice(0, -1);
    else if (k === "-") logState.str = logState.str.startsWith("-") ? logState.str.slice(1) : "-" + logState.str;
    else if (k === ".") { if (!logState.str.includes(".")) logState.str += logState.str === "" || logState.str === "-" ? "0." : "."; }
    else { if (logState.str.replace(/[-.]/g, "").length < 4) logState.str += k; }
    const t2 = currentTemp();
    if (t2 === null || inRange(u, t2)) { logState.action = null; }
    drawLog(u);
  }));

  app.querySelectorAll("[data-ca]").forEach(b => b.addEventListener("click", () => {
    const noteEl = document.getElementById("caNote");
    if (noteEl) logState.note = noteEl.value;
    logState.action = b.getAttribute("data-ca");
    drawLog(u);
  }));
  const noteEl = document.getElementById("caNote");
  if (noteEl) noteEl.addEventListener("input", () => { logState.note = noteEl.value; });

  document.getElementById("saveBtn").addEventListener("click", () => saveEntry(u));
  setupVoice(u);
}

function saveEntry(u) {
  const t = currentTemp();
  if (t === null) return;
  const ok = inRange(u, t);
  if (!ok && !logState.action) { toast("Choose a corrective action first", "err"); return; }
  DB.entries.push({
    id: "e" + Date.now(), unitId: u.id, temp: t, ts: Date.now(),
    ok, action: ok ? null : logState.action, note: ok ? null : (logState.note || null),
  });
  saveDB();
  location.hash = "#today";
  toast(ok ? `✓ ${u.name} ${fmtTemp(t)} logged ${fmtTime(Date.now())}` : `${u.name} ${fmtTemp(t)} logged with corrective action`, ok ? "ok" : "err");
}

/* ---------- voice ---------- */
function setupVoice(u) {
  const btn = document.getElementById("voiceBtn");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.innerHTML = "🎤 Voice not supported here — use the pad below";
    btn.disabled = true; btn.style.opacity = ".55"; btn.style.borderColor = "#c8cdd1"; btn.style.color = "var(--ink-soft)";
    return;
  }
  let rec = null;
  btn.addEventListener("click", () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "en-NZ"; rec.interimResults = false; rec.maxAlternatives = 3;
    btn.classList.add("listening");
    btn.innerHTML = "🎤 Listening… say e.g. “three point five”";
    rec.onresult = (ev) => {
      let val = null;
      for (const alt of ev.results[0]) {
        val = parseSpokenTemp(alt.transcript);
        if (val !== null) break;
      }
      if (val !== null) {
        logState.str = String(val);
        const t2 = currentTemp();
        if (t2 === null || inRange(u, t2)) logState.action = null;
        drawLog(u);
        const okNow = inRange(u, val);
        toast(okNow ? `Heard ${fmtTemp(val)} — tap Save` : `Heard ${fmtTemp(val)} — out of range`, okNow ? "ok" : "err");
      } else {
        toast("Didn't catch a number — try again or type it", "err");
        resetBtn();
      }
    };
    rec.onerror = () => { toast("Voice unavailable — type it instead", "err"); resetBtn(); };
    rec.onend = () => resetBtn();
    function resetBtn() {
      rec = null;
      if (document.getElementById("voiceBtn")) {
        btn.classList.remove("listening");
        btn.innerHTML = '<span style="font-size:1.4rem">🎤</span> Say the temperature';
      }
    }
    try { rec.start(); } catch (e) { resetBtn(); }
  });
}

const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function parseSpokenTemp(raw) {
  let s = " " + raw.toLowerCase().replace(/degrees?|celsius|°c?/g, " ") + " ";
  const neg = /minus|negative/.test(s);
  s = s.replace(/minus|negative/g, " ");
  // direct numeric e.g. "3.5" or "-16"
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (m) { let v = parseFloat(m[0]); if (neg && v > 0) v = -v; return clampTemp(v); }
  // word form: "three point five" / "sixty three"
  const tokens = s.split(/\s+/).filter(Boolean);
  let intPart = null, fracDigits = "", seenPoint = false, acc = null;
  for (const tk of tokens) {
    if (tk === "point" || tk === "dot") { seenPoint = true; intPart = acc !== null ? acc : (intPart !== null ? intPart : 0); acc = null; continue; }
    if (tk in NUM_WORDS) {
      const n = NUM_WORDS[tk];
      if (seenPoint) { fracDigits += String(n); }
      else if (acc !== null && acc % 10 === 0 && acc >= 20 && n < 10) { acc += n; }
      else if (acc === null) { acc = n; }
      else { acc = acc; }
    }
  }
  if (!seenPoint) intPart = acc;
  if (intPart === null && acc !== null) intPart = acc;
  if (intPart === null) return null;
  let v = parseFloat(intPart + (fracDigits ? "." + fracDigits : ""));
  if (isNaN(v)) return null;
  if (neg) v = -v;
  return clampTemp(v);
}
function clampTemp(v) { if (v < -60 || v > 250) return null; return Math.round(v * 10) / 10; }

/* ================= HISTORY ================= */
let histMode = "week";

function renderHistory() {
  const days = histMode === "day" ? 1 : 7;
  const groups = [];
  for (let off = 0; off < days; off++) {
    const k = dateKey(daysAgo(off));
    const es = entriesForDay(k);
    const cl = DB.checklists[k];
    groups.push({ k, es, cl });
  }
  app.innerHTML = `
  <div class="screen">
    <div class="log-head">
      <button class="back-btn" data-nav="#today">‹ Back</button>
      <h2 class="log-title">History</h2>
    </div>
    <div class="seg">
      <button class="${histMode === "day" ? "on" : ""}" data-hist="day">Today</button>
      <button class="${histMode === "week" ? "on" : ""}" data-hist="week">Last 7 days</button>
    </div>
    ${groups.map(g => `
      <div class="day-group">
        <h3>${fmtDay(g.k)}</h3>
        ${g.es.length === 0 ? '<div class="h-row"><span style="color:var(--ink-soft)">No temperatures logged</span></div>' : ""}
        ${g.es.map(e => {
          const u = unitById(e.unitId);
          return `<div class="h-row ${e.ok ? "" : "bad"}">
            <span class="h-temp">${fmtTemp(e.temp)}</span>
            <span class="h-name">${esc(u.name)}</span>
            ${e.ok ? "" : '<span class="badge bad">OUT OF RANGE</span>'}
            <span class="h-time">${fmtTime(e.ts)}</span>
            ${e.ok ? "" : `<div class="h-ca">→ ${esc(actionLabel(e.action))}${e.note ? " — " + esc(e.note) : ""}</div>`}
          </div>`;
        }).join("")}
        ${g.cl ? `<div class="h-row checkrow"><span>Checklists</span>
          <span class="h-time">Opening ${g.cl.opening.filter(Boolean).length}/${OPENING.length} · Closing ${g.cl.closing.filter(Boolean).length}/${CLOSING.length}</span></div>` : ""}
      </div>`).join("")}
  </div>
  <button class="pilot-btn" data-act="pilot">Join the pilot</button>`;
  wire();
  app.querySelectorAll("[data-hist]").forEach(b => b.addEventListener("click", () => { histMode = b.getAttribute("data-hist"); renderHistory(); }));
}

/* ================= VERIFICATION PACK ================= */
let packRange = { preset: "7", from: null, to: null };

function packDates() {
  let from, to;
  const today = new Date();
  if (packRange.preset === "custom" && packRange.from && packRange.to) {
    from = packRange.from; to = packRange.to;
  } else {
    const n = parseInt(packRange.preset, 10);
    to = dateKey(today); from = dateKey(daysAgo(n - 1));
  }
  if (from > to) { const t = from; from = to; to = t; }
  const keys = [];
  const d = new Date(from + "T12:00:00");
  while (dateKey(d) <= to) { keys.push(dateKey(d)); d.setDate(d.getDate() + 1); }
  return { from, to, keys };
}

function renderPack() {
  const { from, to, keys } = packDates();
  const all = DB.entries.filter(e => { const k = dateKey(new Date(e.ts)); return k >= from && k <= to; });
  const oor = all.filter(e => !e.ok);
  const gaps = [];
  for (const k of keys) {
    for (const u of UNITS) {
      if (!all.some(e => e.unitId === u.id && dateKey(new Date(e.ts)) === k)) gaps.push({ k, u });
    }
  }
  const clRows = keys.map(k => {
    const c = DB.checklists[k];
    const o = c ? c.opening.filter(Boolean).length : 0;
    const cd = c ? c.closing.filter(Boolean).length : 0;
    return { k, o, cd, oTot: OPENING.length, cTot: CLOSING.length };
  });
  const clGaps = clRows.filter(r => r.o < r.oTot || r.cd < r.cTot);

  const unitSection = (u) => {
    const es = all.filter(e => e.unitId === u.id).sort((a, b) => a.ts - b.ts);
    const unitGaps = gaps.filter(g => g.u.id === u.id);
    return `
    <h3>${esc(u.name)} <span style="font-weight:400;color:var(--ink-soft);font-size:.85rem">— safe range ${u.min} to ${u.max}°C</span></h3>
    ${es.length ? `<table class="pack-table">
      <thead><tr><th>Date</th><th>Time</th><th class="num">Reading</th><th>Status</th></tr></thead>
      <tbody>
      ${es.map(e => `<tr class="${e.ok ? "" : "oor"}">
        <td>${fmtDay(dateKey(new Date(e.ts)))}</td>
        <td>${fmtTime(e.ts)}</td>
        <td class="num">${fmtTemp(e.temp)}</td>
        <td>${e.ok ? '<span class="badge ok">In range</span>' : '<span class="badge bad">OUT OF RANGE</span>'}</td>
      </tr>`).join("")}
      </tbody></table>` : '<div class="gap-line">No readings recorded for this unit in the selected period.</div>'}
    ${unitGaps.map(g => `<div class="gap-line">⚠ Gap: no reading recorded on ${fmtDay(g.k)}</div>`).join("")}`;
  };

  app.innerHTML = `
  <div class="screen">
    <div class="log-head">
      <button class="back-btn" data-nav="#today">‹ Back</button>
      <h2 class="log-title">Verification Pack</h2>
    </div>
    <div class="range-row">
      ${[["7", "Last 7 days"], ["14", "Last 14 days"], ["30", "Last 30 days"], ["custom", "Custom"]].map(([v, l]) =>
        `<button class="chip ${packRange.preset === v ? "on" : ""}" data-range="${v}">${l}</button>`).join("")}
    </div>
    ${packRange.preset === "custom" ? `<div class="custom-dates">
      <input type="date" id="dFrom" value="${packRange.from || from}">
      <input type="date" id="dTo" value="${packRange.to || to}">
    </div>` : ""}
    <button class="print-btn" id="printBtn">🖨 Print / Save as PDF</button>

    <div class="pack-doc" id="packDoc">
      <h2>Food Control Plan — Verification Pack</h2>
      <div class="pd-sub">${esc(VENUE)}</div>
      <div class="pd-meta">Period: ${fmtDayLong(from)} – ${fmtDayLong(to)} · Generated ${new Date().toLocaleString("en-NZ", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} · FoodOps digital records</div>

      <div class="pack-summary">
        <div class="stat"><b>${all.length}</b>temp checks</div>
        <div class="stat ${oor.length ? "red" : "green"}"><b>${oor.length}</b>out of range</div>
        <div class="stat ${oor.length && oor.every(e => e.action) ? "green" : oor.length ? "red" : "green"}"><b>${oor.filter(e => e.action).length}/${oor.length}</b>actions recorded</div>
        <div class="stat ${gaps.length ? "red" : "green"}"><b>${gaps.length}</b>gaps</div>
      </div>

      <h3>Out-of-range events & corrective actions</h3>
      ${oor.length === 0 ? "<p>No out-of-range temperatures were recorded in this period.</p>" :
        oor.map(e => {
          const u = unitById(e.unitId);
          return `<div class="ca-callout">
            <div class="cc-head">✗ ${esc(u.name)} — ${fmtTemp(e.temp)} (safe: ${u.min} to ${u.max}°C)</div>
            <div>${fmtDayLong(dateKey(new Date(e.ts)))} at ${fmtTime(e.ts)}</div>
            <div class="cc-act"><b>Corrective action:</b> ${esc(actionLabel(e.action))}${e.note ? `<br><b>Note:</b> ${esc(e.note)}` : ""}</div>
          </div>`;
        }).join("")}

      <h3>Temperature records by unit</h3>
      ${UNITS.map(unitSection).join("")}

      <h3>Opening & closing checklists</h3>
      <table class="pack-table">
        <thead><tr><th>Date</th><th>Opening</th><th>Closing</th></tr></thead>
        <tbody>
        ${clRows.map(r => `<tr>
          <td>${fmtDay(r.k)}</td>
          <td>${r.o}/${r.oTot} ${r.o === r.oTot ? '<span class="badge ok">Complete</span>' : '<span class="badge bad">Incomplete</span>'}</td>
          <td>${r.cd}/${r.cTot} ${r.cd === r.cTot ? '<span class="badge ok">Complete</span>' : '<span class="badge bad">Incomplete</span>'}</td>
        </tr>`).join("")}
        </tbody></table>
      ${clGaps.length ? `<div class="gap-line" style="margin-top:8px">⚠ ${clGaps.length} day(s) with incomplete checklists — shown above.</div>` : ""}

      <div class="sig-row">
        <div class="sig">Reviewed by (name)</div>
        <div class="sig">Signature</div>
        <div class="sig">Date</div>
      </div>
      <div class="pack-foot">Generated by FoodOps — digital food safety records. Records are entered by staff at the time of checking; out-of-range readings cannot be saved without a corrective action.</div>
    </div>
  </div>
  <button class="pilot-btn" data-act="pilot">Join the pilot</button>`;
  wire();

  app.querySelectorAll("[data-range]").forEach(b => b.addEventListener("click", () => {
    packRange.preset = b.getAttribute("data-range");
    if (packRange.preset === "custom") { packRange.from = from; packRange.to = to; }
    renderPack();
  }));
  ["dFrom", "dTo"].forEach(id => {
    const i = document.getElementById(id);
    if (i) i.addEventListener("change", () => {
      packRange[id === "dFrom" ? "from" : "to"] = i.value;
      renderPack();
    });
  });
  document.getElementById("printBtn").addEventListener("click", () => {
    document.body.classList.add("printing-pack");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-pack"), 500);
  });
}

function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).finally(() => clearTimeout(t));
}

/* ================= PILOT FORM ================= */
function openPilot() {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `
  <div class="modal">
    <h2>Join the pilot</h2>
    <p class="m-sub">Be one of the first NZ venues on FoodOps. No cost during the trial.</p>
    <label class="f-label">Your name</label>
    <input class="f-input" id="pName" autocomplete="name">
    <label class="f-label">Email</label>
    <input class="f-input" id="pEmail" type="email" autocomplete="email" inputmode="email">
    <label class="f-label">Venue name</label>
    <input class="f-input" id="pVenue">
    <label class="f-label">Number of fridges / freezers / hot holds</label>
    <input class="f-input" id="pFridges" type="number" inputmode="numeric" min="1" max="50">
    <label class="f-label">Would you pay $49/month for this?</label>
    <div class="pay-row">
      <button data-pay="yes">Yes</button>
      <button data-pay="maybe">Maybe</button>
      <button data-pay="no">No</button>
    </div>
    <div class="form-err" id="pErr"></div>
    <button class="save-btn" id="pSubmit">Send — join the pilot</button>
    <button class="m-close" id="pClose">Not now</button>
  </div>`;
  document.body.appendChild(wrap);
  let pay = null;
  wrap.querySelectorAll("[data-pay]").forEach(b => b.addEventListener("click", () => {
    pay = b.getAttribute("data-pay");
    wrap.querySelectorAll("[data-pay]").forEach(x => x.classList.toggle("sel", x === b));
  }));
  wrap.querySelector("#pClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector("#pSubmit").addEventListener("click", async () => {
    const s = {
      name: wrap.querySelector("#pName").value.trim(),
      email: wrap.querySelector("#pEmail").value.trim(),
      venue: wrap.querySelector("#pVenue").value.trim(),
      fridges: wrap.querySelector("#pFridges").value.trim(),
      pay,
      ts: Date.now(),
      ua: navigator.userAgent.slice(0, 80),
    };
    const err = wrap.querySelector("#pErr");
    if (!s.name || !s.email || !s.venue) { err.textContent = "Name, email and venue are required."; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) { err.textContent = "That email doesn't look right."; return; }
    if (!s.pay) { err.textContent = "Please answer the $49/month question."; return; }
    const btn = wrap.querySelector("#pSubmit");
    btn.disabled = true; btn.textContent = "Sending…";
    // always keep a local copy
    DB.localSignups.push(s); saveDB();
    // best-effort central store (6s cap so slow networks never block the user)
    try {
      const r = await fetchT(SIGNUP_BLOB, { method: "GET" }, 6000);
      const data = r.ok ? await r.json() : { signups: [] };
      if (!Array.isArray(data.signups)) data.signups = [];
      data.signups.push(s);
      await fetchT(SIGNUP_BLOB, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }, 6000);
      s.synced = true; saveDB();
    } catch (e) { /* offline — stays in local copy */ }
    wrap.remove();
    toast("✓ You're on the pilot list — we'll be in touch", "ok");
  });
}

/* ================= SIGNUPS (hidden admin) ================= */
async function renderSignups() {
  app.innerHTML = `
  <div class="screen">
    <div class="log-head">
      <button class="back-btn" data-nav="#today">‹ Back</button>
      <h2 class="log-title">Pilot signups</h2>
    </div>
    <div class="empty-note">Loading…</div>
  </div>`;
  wire();
  let central = [];
  let centralOk = false;
  try {
    const r = await fetchT(SIGNUP_BLOB, {}, 6000);
    if (r.ok) { const d = await r.json(); central = Array.isArray(d.signups) ? d.signups : []; centralOk = true; }
  } catch (e) { /* offline */ }
  const local = DB.localSignups || [];
  const seen = new Set(central.map(s => s.email + "|" + s.ts));
  const merged = central.concat(local.filter(s => !seen.has(s.email + "|" + s.ts)));
  merged.sort((a, b) => b.ts - a.ts);

  const rows = merged.map(s => `
    <div class="signup-card">
      <span class="pay-tag pay-${esc(s.pay)}">${s.pay === "yes" ? "$49 YES" : s.pay === "maybe" ? "$49 maybe" : "$49 no"}</span>
      <b>${esc(s.name)}</b> — ${esc(s.venue)}
      <div class="s-meta">${esc(s.email)} · ${esc(s.fridges || "?")} units · ${new Date(s.ts).toLocaleString("en-NZ")}</div>
    </div>`).join("");

  app.innerHTML = `
  <div class="screen">
    <div class="log-head">
      <button class="back-btn" data-nav="#today">‹ Back</button>
      <h2 class="log-title">Pilot signups (${merged.length})</h2>
    </div>
    ${centralOk ? "" : '<div class="trial-banner">Couldn\'t reach the central list — showing signups made on this device only.</div>'}
    ${merged.length ? rows : '<div class="empty-note">No signups yet. Hand the link to a café owner and demo the Verification Pack.</div>'}
    ${merged.length ? '<button class="flat-btn" style="width:100%" id="csvBtn">⬇ Download CSV</button>' : ""}
  </div>`;
  wire();
  const csvBtn = document.getElementById("csvBtn");
  if (csvBtn) csvBtn.addEventListener("click", () => {
    const head = "name,email,venue,fridges,would_pay_49,timestamp\n";
    const body = merged.map(s => [s.name, s.email, s.venue, s.fridges, s.pay, new Date(s.ts).toISOString()]
      .map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([head + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foodops-pilot-signups.csv";
    a.click();
  });
}

/* ================= WIRING ================= */
function wire() {
  document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => { location.hash = b.getAttribute("data-nav"); }));
  document.querySelectorAll("[data-act='reset']").forEach(b => b.addEventListener("click", () => {
    if (confirm("Reset all records back to the demo data?")) resetDemo();
  }));
  document.querySelectorAll("[data-act='pilot']").forEach(b => b.addEventListener("click", openPilot));
  document.querySelectorAll("[data-togglecl]").forEach(b => b.addEventListener("click", () => {
    document.getElementById("cc-" + b.getAttribute("data-togglecl")).classList.toggle("open");
  }));
  document.querySelectorAll("[data-check]").forEach(b => b.addEventListener("click", () => {
    const [which, i] = b.getAttribute("data-check").split(":");
    const k = dateKey(new Date());
    const cl = checklistFor(k);
    cl[which][+i] = !cl[which][+i];
    saveDB();
    const wasOpen = which;
    renderToday();
    document.getElementById("cc-" + wasOpen).classList.add("open");
  }));
}

/* ================= BOOT ================= */
loadDB();
route();
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
