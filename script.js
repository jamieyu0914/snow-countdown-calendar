const KEY = "countdown-calendar-v1";
const pad2 = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

let state = { name: "2027 新年", start: ymd(new Date()), date: "2027-01-01", time: "00:00", marks: {} };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.date) state = { ...state, ...s }; } catch (e) {}
if (!state.marks) state.marks = {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

const $ = id => document.getElementById(id);
const target = () => new Date(`${state.date}T${state.time || "00:00"}`);
let view = new Date();

function tick() {
  const now = new Date(), t = target();
  $("eventName").textContent = state.name || "目標日";
  const crossedCount = Object.keys(state.marks).length;
  if (t - now <= 0) {
    $("countWrap").innerHTML = '<div class="done-msg">🎉 時間到了！</div>';
    $("barFill").style.width = "100%";
    $("barLabel").textContent = `倒數完成・共劃掉 ${crossedCount} 天`;
    return;
  }
  if (!$("days")) location.reload();
  const s = Math.floor((t - now) / 1000);
  $("days").textContent = Math.floor(s / 86400);
  $("hrs").textContent = pad2(Math.floor(s % 86400 / 3600));
  $("mins").textContent = pad2(Math.floor(s % 3600 / 60));
  $("secs").textContent = pad2(s % 60);
  const start = new Date(`${state.start}T00:00`);
  const total = t - start;
  const pct = total > 0 ? Math.min(100, Math.max(0, (now - start) / total * 100)) : 0;
  $("barFill").style.width = pct.toFixed(1) + "%";
  $("barLabel").textContent = `已經過 ${pct.toFixed(1)}%・已劃掉 ${crossedCount} 天`;
}

const strokesToSvg = strokes =>
  `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${strokes.map(s =>
    `<polyline points="${s.map(p => `${(p[0]*100).toFixed(1)},${(p[1]*100).toFixed(1)}`).join(" ")}"/>`).join("")}</svg>`;

function renderCal() {
  const y = view.getFullYear(), m = view.getMonth();
  $("monthTitle").textContent = `${y} 年 ${m + 1} 月`;
  const g = $("grid"); g.innerHTML = "";
  "日一二三四五六".split("").forEach(d => g.insertAdjacentHTML("beforeend", `<div class="dow">${d}</div>`));
  const first = new Date(y, m, 1).getDay(), count = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) g.insertAdjacentHTML("beforeend", "<div></div>");
  const today = dayStart(new Date()), tgt = dayStart(target()), st = dayStart(new Date(`${state.start}T00:00`));
  for (let d = 1; d <= count; d++) {
    const cur = new Date(y, m, d), key = ymd(cur), cls = ["day"];
    let note = "";
    const mark = state.marks[key];
    if (cur.getTime() === tgt.getTime()) { cls.push("target"); note = "🎯"; }
    else if (cur >= st && cur < tgt) { cls.push("range"); note = `剩${Math.round((tgt - cur) / 86400000)}`; }
    if (cur <= today) cls.push("clickable");
    if (mark) cls.push("crossed");
    if (cur.getTime() === today.getTime()) cls.push("today");
    g.insertAdjacentHTML("beforeend",
      `<div class="${cls.join(" ")}" data-key="${key}">${d}${note ? `<small>${note}</small>` : ""}${mark ? strokesToSvg(mark) : ""}</div>`);
  }
}

$("grid").addEventListener("click", e => {
  const cell = e.target.closest(".day.clickable");
  if (cell) openPad(cell.dataset.key);
});
$("prev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); };
$("next").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); };

/* ---------- 畫叉 ---------- */
const canvas = $("canvas"), ctx = canvas.getContext("2d");
let strokes = [], current = null, padKey = null, autoTimer = null;

function sizeCanvas() {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  redraw();
}
function redraw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#5b8fd6";
  ctx.lineWidth = w * 0.045; ctx.lineCap = "round"; ctx.lineJoin = "round";
  [...strokes, ...(current ? [current] : [])].forEach(s => {
    ctx.beginPath();
    s.forEach((p, i) => i ? ctx.lineTo(p[0]*w, p[1]*h) : ctx.moveTo(p[0]*w, p[1]*h));
    if (s.length === 1) ctx.lineTo(s[0][0]*w + 0.1, s[0][1]*h);
    ctx.stroke();
  });
}
function pos(e) {
  const r = canvas.getBoundingClientRect();
  return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
}
canvas.addEventListener("pointerdown", e => {
  clearTimeout(autoTimer);
  canvas.setPointerCapture(e.pointerId);
  current = [pos(e)]; redraw();
});
canvas.addEventListener("pointermove", e => {
  if (!current) return;
  const p = pos(e), last = current[current.length - 1];
  if (Math.hypot(p[0]-last[0], p[1]-last[1]) > 0.005) { current.push(p); redraw(); }
});
const endStroke = () => {
  if (!current) return;
  if (current.length > 2) strokes.push(current);
  current = null; redraw();
  // 畫完兩筆（一個 ✕）自動完成
  if (strokes.length >= 2) autoTimer = setTimeout(finish, 600);
};
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

function openPad(key) {
  padKey = key;
  const [y, m, d] = key.split("-").map(Number);
  const wk = "日一二三四五六"[new Date(y, m - 1, d).getDay()];
  $("padTitle").textContent = `${m} 月 ${d} 日（${wk}）`;
  $("padNum").textContent = d;
  strokes = (state.marks[key] || []).map(s => s.slice());
  $("btnClear").textContent = state.marks[key] ? "移除 ✕" : "清除";
  $("modal").classList.add("open");
  requestAnimationFrame(sizeCanvas);
}
function closePad() { clearTimeout(autoTimer); $("modal").classList.remove("open"); current = null; }
function finish() {
  clearTimeout(autoTimer);
  if (strokes.length) state.marks[padKey] = strokes.map(s => s.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]));
  else delete state.marks[padKey];
  const added = strokes.length > 0;
  save(); renderCal(); tick(); closePad();
  if (added) celebrate();
}

/* ---------- 吉祥物 ---------- */
let bubbleTimer = null;
function say(text, ms = 3500) {
  const b = $("bubble");
  b.textContent = text; b.classList.add("show");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove("show"), ms);
}
function daysLeft() { return Math.max(0, Math.ceil((dayStart(target()) - dayStart(new Date())) / 86400000)); }
function hop() {
  const m = $("mascot");
  m.classList.remove("happy"); void m.offsetWidth; m.classList.add("happy");
}
function snow(n = 18) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement("div");
    s.className = "snowfx"; s.textContent = "❄";
    s.style.left = Math.random() * 100 + "vw";
    s.style.fontSize = 10 + Math.random() * 14 + "px";
    s.style.animationDuration = 2 + Math.random() * 2 + "s";
    s.style.animationDelay = Math.random() * .6 + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 5000);
  }
}
function celebrate() {
  hop(); snow();
  const n = daysLeft();
  const lines = n > 0
    ? [`又劃掉一天！ ✨`, `好棒！`, `打叉成功～加油！`]
    : ["就是今天啦！🎉"];
  say(lines[Math.floor(Math.random() * lines.length)]);
}
$("mascot").addEventListener("click", () => {
  hop();
  const n = daysLeft(), todayMarked = !!state.marks[ymd(new Date())];
  const lines = n === 0 ? ["今天就是目標日！🎉"]
    : todayMarked ? ["今天已經劃掉囉，Fighting！", "明天見～", "一天一天慢慢來 ☃"]
    : ["今天還沒打叉喔！", "點今天畫個 ✕ 吧"];
  say(lines[Math.floor(Math.random() * lines.length)]);
});
setTimeout(() => say(state.marks[ymd(new Date())] ? "今天已經劃掉囉 ☃" : `嗨 ${state.user}！還有 ${daysLeft()} 天`), 600);
$("btnDone").onclick = finish;
$("btnCancel").onclick = closePad;
$("btnClear").onclick = () => {
  clearTimeout(autoTimer);
  if (state.marks[padKey] && $("btnClear").textContent === "移除 ✕") {
    delete state.marks[padKey]; save(); renderCal(); tick(); closePad(); return;
  }
  strokes = []; redraw();
};
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closePad(); });
window.addEventListener("resize", () => { if ($("modal").classList.contains("open")) sizeCanvas(); });

/* ---------- 設定 ---------- */
[["inName","name"],["inStart","start"],["inDate","date"],["inTime","time"]].forEach(([id, k]) => {
  $(id).value = state[k];
  $(id).addEventListener("input", e => {
    if ((k === "date" || k === "start") && !e.target.value) return;
    state[k] = e.target.value; save();
    if (k === "date") view = target();
    renderCal(); tick();
  });
});

/* ---------- 問候與名字 ---------- */
if (!state.user) state.user = "YaTsen";
function renderName() { $("who").textContent = state.user; document.title = `Hi ${state.user}・倒數月曆`; }
function editName() {
  const h = $("hello");
  h.innerHTML = `<h2>Hi</h2><input id="nameIn" type="text" maxlength="20" aria-label="名字">
    <button class="icon-btn" id="nameOk">儲存</button><button class="icon-btn" id="nameNo">取消</button>`;
  const inp = $("nameIn"); inp.value = state.user; inp.focus(); inp.select();
  const done = ok => {
    if (ok && inp.value.trim()) { state.user = inp.value.trim(); save(); }
    h.innerHTML = `<h2 id="helloText">Hi <span class="who" id="who"></span> !</h2>
      <button class="icon-btn" id="editName" aria-label="編輯名字">✎ 編輯</button>`;
    $("editName").onclick = editName; renderName();
    if (ok) { hop(); say(`哈囉 ${state.user}！`); }
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
  $("nameOk").onclick = () => done(true);
  $("nameNo").onclick = () => done(false);
}
$("editName").onclick = editName;
renderName();

renderCal(); tick(); setInterval(tick, 1000);
