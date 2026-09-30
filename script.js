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

const STICKERS = {
  star: `<path d="M50 8 L61 37 L93 38 L68 58 L77 90 L50 72 L23 90 L32 58 L7 38 L39 37 Z" fill="#f5c52f" stroke="#e0a91f" stroke-width="4" stroke-linejoin="round"/>
         <circle cx="40" cy="50" r="4" fill="#2b2a28"/><circle cx="60" cy="50" r="4" fill="#2b2a28"/>
         <path d="M44 60 Q50 65 56 60" stroke="#2b2a28" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  heart: `<path d="M50 88 C20 66 6 50 6 32 C6 18 17 8 30 8 C39 8 46 13 50 20 C54 13 61 8 70 8 C83 8 94 18 94 32 C94 50 80 66 50 88 Z" fill="#f07b8a" stroke="#d95f70" stroke-width="4"/>
          <ellipse cx="30" cy="28" rx="8" ry="5" fill="#fff" opacity=".5" transform="rotate(-30 30 28)"/>`
};
const stickerArt = id => STICKERS[id] || (typeof MASCOTS !== "undefined" && MASCOTS[id] ? MASCOTS[id].art : "");
const markToSvg = mark => Array.isArray(mark) ? strokesToSvg(mark)
  : `<svg class="stamp" viewBox="0 0 100 100" style="transform:rotate(${mark.r || 0}deg)">${stickerArt(mark.s)}</svg>`;
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
      `<div class="${cls.join(" ")}" data-key="${key}">${d}${note ? `<small>${note}</small>` : ""}${mark ? markToSvg(mark) : ""}</div>`);
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
  const mk = state.marks[key];
  strokes = Array.isArray(mk) ? mk.map(s => s.slice()) : [];
  $("btnClear").textContent = mk ? "移除 ✕" : "清除";
  const ids = ["star", "heart", ...Object.keys(MASCOTS)];
  $("stickers").innerHTML = ids.map(id =>
    `<button data-s="${id}" class="${mk && mk.s === id ? "on" : ""}" aria-label="${STICKERS[id] ? (id === "star" ? "星星" : "愛心") : MASCOTS[id].name} 貼紙">
      <svg viewBox="0 0 100 100">${stickerArt(id)}</svg></button>`).join("");
  $("modal").classList.add("open");
  requestAnimationFrame(sizeCanvas);
}
$("stickers").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  state.marks[padKey] = { s: b.dataset.s, r: Math.round(Math.random() * 24 - 12) };
  save(); renderCal(); tick(); closePad(); celebrate();
});
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
function snow() {
  const m = MASCOTS[state.mascot] || {};
  const items = m.fx || ["❄️"], dir = m.dir || "down";
  const W = innerWidth, H = innerHeight, rnd = (a, b) => a + Math.random() * (b - a);
  const T = (x, y, r = 0, sx = 1, sy = sx) => `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`;
  const n = { concert: 36, bounce: 28, leaf: 34 }[dir] || 40;
  // 音樂表演：從吉祥物身上跟著節拍湧出
  const mr = $("mascot").getBoundingClientRect(), vis = mr.top > 0 && mr.bottom < H;
  const ox = vis ? mr.left + mr.width / 2 - 14 : W / 2 - 14, oy = vis ? mr.top + mr.height * .45 : H - 30;
  if (dir === "concert") {
    const beat = 420;
    $("mascot").animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }],
      { duration: beat, iterations: 6, easing: "ease-out" });
  }
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "snowfx";
    el.textContent = items[i % items.length];
    el.style.left = "0px"; el.style.top = "0px";
    el.style.fontSize = rnd(18, 32) + "px";
    let kf, opt;
    if (dir === "concert") {
      const ang = (rnd(-70, 70) + (oy < H * .4 ? 215 : 0)) * Math.PI / 180, dist = rnd(H * .45, H * .8), steps = 12;
      kf = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ox + Math.sin(ang) * dist * t + Math.sin(t * Math.PI * 4 + i) * 18;
        const y = oy - Math.cos(ang) * dist * t;
        const pulse = s % 2 ? 1.35 : 1;
        kf.push({ transform: T(x, y, Math.sin(t * Math.PI * 4) * 20, pulse * (.4 + t * .8 > 1 ? 1 : .4 + t * .8)),
                  opacity: t > .8 ? (1 - t) * 5 : 1 });
      }
      opt = { duration: 420 * steps / 2, delay: i * 90, easing: "linear" };
    } else if (dir === "bounce") {
      // 打鼓：落下後咚咚彈跳
      const x = rnd(10, W - 50), floor = H - 50, h1 = rnd(H * .18, H * .3), h2 = h1 * .4, r = rnd(-30, 30);
      kf = [
        { offset: 0,   transform: T(x, -50, 0), easing: "ease-in" },
        { offset: .4,  transform: T(x, floor, r, 1.25, .7), easing: "ease-out" },
        { offset: .58, transform: T(x, floor - h1, r * 1.5), easing: "ease-in" },
        { offset: .74, transform: T(x, floor, r * 2, 1.2, .78), easing: "ease-out" },
        { offset: .84, transform: T(x, floor - h2, r * 2.3), easing: "ease-in" },
        { offset: .93, transform: T(x, floor, r * 2.5, 1.1, .88), opacity: 1 },
        { offset: 1,   transform: T(x, floor, r * 2.5), opacity: 0 }];
      opt = { duration: rnd(2000, 2600), delay: i * 90 };
    } else if (dir === "leaf") {
      // 落葉：像葉子一樣左右擺盪、傾斜飄落
      const x0 = rnd(0, W - 30), amp = rnd(40, 90), swings = rnd(2, 3.5), steps = 16;
      kf = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, ph = t * Math.PI * swings;
        kf.push({ transform: T(x0 + Math.sin(ph) * amp, -50 + t * (H + 100), Math.cos(ph) * 40) });
      }
      opt = { duration: rnd(4000, 5500), delay: rnd(0, 1800), easing: "ease-in-out" };
    } else {
      const x = rnd(0, W), spin = rnd(-360, 360);
      kf = [{ transform: T(x, -40, 0) }, { transform: T(x + rnd(-40, 40), H + 40, spin) }];
      opt = { duration: rnd(2200, 4000), delay: rnd(0, 1200), easing: "linear" };
    }
    document.body.appendChild(el);
    el.animate(kf, { ...opt, fill: "both" }).onfinish = () => el.remove();
  }
}
function celebrate() {
  hop(); snow();
  const n = daysLeft();
  const lines = n > 0
    ? [`又劃掉一天！剩 ${n} 天 ✨`, `好棒！再 ${n} 天就到了`, `打叉成功～加油！`]
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

/* ---------- 吉祥物切換 ---------- */
const MASCOTS = {
  snow: { name: "Snow", fx: ["❄️"], dir: "down", color: "#5b8fd6", art: `
          <ellipse cx="50" cy="94" rx="26" ry="4" fill="#000" opacity=".08"/>
          <!-- 手套 -->
          <circle cx="17" cy="64" r="7" fill="#5b8fd6"/>
          <circle cx="83" cy="64" r="7" fill="#5b8fd6"/>
          <!-- 身體 -->
          <circle cx="50" cy="60" r="33" fill="#fdfdfd" stroke="#dfe7ef" stroke-width="2"/>
          <!-- 毛線帽 -->
          <path d="M22 44 Q50 2 78 44 Z" fill="#e0605a"/>
          <rect x="20" y="40" width="60" height="9" rx="4.5" fill="#f3f0ea"/>
          <circle cx="50" cy="12" r="7" fill="#f3f0ea"/>
          <path d="M34 30 L38 40 M50 24 L50 40 M66 30 L62 40" stroke="#c94b46" stroke-width="2" stroke-linecap="round"/>
          <!-- 臉 -->
          <ellipse class="eye" cx="40" cy="60" rx="3.2" ry="4" fill="#2b2a28"/>
          <ellipse class="eye" cx="60" cy="60" rx="3.2" ry="4" fill="#2b2a28"/>
          <circle cx="33" cy="68" r="4.5" fill="#f7b6b0" opacity=".8"/>
          <circle cx="67" cy="68" r="4.5" fill="#f7b6b0" opacity=".8"/>
          <path d="M45 68 Q50 73 55 68" stroke="#2b2a28" stroke-width="2.2" fill="none" stroke-linecap="round"/>
          <!-- 圍巾 -->
          <path d="M24 80 Q50 90 76 80 L74 86 Q50 96 26 86 Z" fill="#5b8fd6"/>
          <rect x="62" y="84" width="9" height="14" rx="3" fill="#5b8fd6" transform="rotate(-10 66 90)"/>
        ` },
  pip: { name: "Bean", fx: ["🎶","🎸","🎹"], dir: "concert", color: "#7cae5a", art: `
          <ellipse cx="50" cy="95" rx="26" ry="4" fill="#000" opacity=".08"/>
          <!-- 腳 -->
          <path d="M38 88 L32 95 L44 95 Z" fill="#f08a3c"/>
          <path d="M58 88 L52 95 L64 95 Z" fill="#f08a3c"/>
          <!-- 身體 + 吊帶褲 -->
          <ellipse cx="50" cy="72" rx="24" ry="19" fill="#fdfdfd" stroke="#dfe3e8" stroke-width="1.5"/>
          <path d="M28 74 Q50 98 72 74 L72 72 Q50 80 28 72 Z" fill="#7cae5a"/>
          <rect x="40" y="70" width="20" height="14" rx="3" fill="#7cae5a"/>
          <path d="M41 70 L36 58 M59 70 L64 58" stroke="#7cae5a" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="50" cy="77" r="2" fill="#f3f0ea"/>
          <!-- 小翅膀 -->
          <ellipse cx="27" cy="70" rx="6" ry="9" fill="#eef1f4" transform="rotate(20 27 70)"/>
          <!-- 麥克風 -->
          <g transform="rotate(25 70 64)">
            <rect x="66.5" y="60" width="7" height="22" rx="3" fill="#3b3f47"/>
            <rect x="66" y="60" width="8" height="3" fill="#5bb5c9"/>
            <circle cx="70" cy="52" r="9" fill="#c9ced6" stroke="#9aa1ab" stroke-width="1.5"/>
            <path d="M62 49 L78 49 M61.5 53 L78.5 53 M63 57 L77 57 M66 44 L66 60 M70 43 L70 61 M74 44 L74 60" stroke="#9aa1ab" stroke-width="1"/>
          </g>
          <ellipse cx="68" cy="72" rx="5" ry="7" fill="#eef1f4"/>
          <!-- 頭 -->
          <circle cx="48" cy="40" r="20" fill="#fdfdfd" stroke="#dfe3e8" stroke-width="1.5"/>
          <ellipse class="eye" cx="41" cy="40" rx="2.8" ry="3.4" fill="#2b2a28"/>
          <ellipse class="eye" cx="55" cy="40" rx="2.8" ry="3.4" fill="#2b2a28"/>
          <circle cx="36" cy="47" r="3.5" fill="#f7a39a" opacity=".7"/>
          <circle cx="60" cy="47" r="3.5" fill="#f7a39a" opacity=".7"/>
          <ellipse cx="48" cy="48" rx="7" ry="3.5" fill="#f08a3c"/>
          <path d="M42 48 Q48 51 54 48" stroke="#c96a26" stroke-width="1.2" fill="none"/>
          <!-- 棒球帽 -->
          <path d="M30 32 Q30 12 48 12 Q66 12 66 32 Z" fill="#3f78c8"/>
          <path d="M48 12 L48 32 M38 15 Q36 24 37 32 M58 15 Q60 24 59 32" stroke="#2f5f9e" stroke-width="1.2" fill="none"/>
          <circle cx="48" cy="12.5" r="2.2" fill="#2f5f9e"/>
          <path d="M60 30 Q76 28 80 33 Q70 36 58 34 Z" fill="#2f5f9e"/>
          <circle cx="45" cy="23" r="3.5" fill="#fff"/>
          <path d="M43.5 23 L46.5 23 M45 21.5 L45 24.5" stroke="#3f78c8" stroke-width="1.2"/>
        ` },
  bobo: { name: "Teddy", fx: ["🥁","🍯"], dir: "bounce", color: "#2f7a5f", art: `
          <ellipse cx="50" cy="95" rx="24" ry="4" fill="#000" opacity=".08"/>
          <!-- 腳 -->
          <rect x="37" y="84" width="10" height="11" rx="4" fill="#3b2a20"/>
          <rect x="53" y="84" width="10" height="11" rx="4" fill="#3b2a20"/>
          <!-- 手 -->
          <circle cx="24" cy="70" r="6.5" fill="#a5714a"/>
          <circle cx="76" cy="70" r="6.5" fill="#a5714a"/>
          <!-- 制服 -->
          <rect x="28" y="56" width="44" height="32" rx="14" fill="#2f7a5f"/>
          <path d="M30 58 L70 86 M70 58 L30 86" stroke="#f3f0ea" stroke-width="4" stroke-linecap="round"/>
          <!-- 小鼓 -->
          <rect x="38" y="70" width="24" height="13" rx="3" fill="#f3f0ea" stroke="#c9a24a" stroke-width="2"/>
          <path d="M38 73 L62 73 M38 80 L62 80" stroke="#c9a24a" stroke-width="2"/>
          <path d="M42 73 L48 80 L54 73 L60 80" stroke="#2f7a5f" stroke-width="1.5" fill="none"/>
          <!-- 耳朵 -->
          <circle cx="30" cy="22" r="8" fill="#a5714a"/>
          <circle cx="70" cy="22" r="8" fill="#a5714a"/>
          <circle cx="30" cy="22" r="4" fill="#d9a77c"/>
          <circle cx="70" cy="22" r="4" fill="#d9a77c"/>
          <!-- 頭 -->
          <circle cx="50" cy="40" r="23" fill="#a5714a"/>
          <ellipse cx="50" cy="48" rx="10" ry="7.5" fill="#e8c7a3"/>
          <ellipse cx="50" cy="45" rx="3.2" ry="2.4" fill="#3b2a20"/>
          <path d="M47 50 Q50 53 53 50" stroke="#3b2a20" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <ellipse class="eye" cx="41" cy="39" rx="2.8" ry="3.4" fill="#2b2a28"/>
          <ellipse class="eye" cx="59" cy="39" rx="2.8" ry="3.4" fill="#2b2a28"/>
          <circle cx="34" cy="47" r="3.5" fill="#f7a39a" opacity=".6"/>
          <circle cx="66" cy="47" r="3.5" fill="#f7a39a" opacity=".6"/>
          <!-- 大盤帽 -->
          <ellipse cx="50" cy="22" rx="22" ry="7" fill="#2f7a5f"/>
          <rect x="34" y="21" width="32" height="7" rx="2" fill="#f3f0ea"/>
          <path d="M34 28 Q50 34 66 28 L66 30 Q50 37 34 30 Z" fill="#1f4f3e"/>
          <path d="M50 14 l1.8 3.7 4 .6 -2.9 2.8 .7 4 -3.6-1.9 -3.6 1.9 .7-4 -2.9-2.8 4-.6 Z" fill="#e8b93c"/>
        ` },
  momo: { name: "Coffee", fx: ["🍃","☕"], dir: "leaf", color: "#d4935a", art: `
          <ellipse cx="50" cy="94" rx="26" ry="4" fill="#000" opacity=".08"/>
          <!-- 尾巴 -->
          <path d="M78 78 Q96 70 90 52" stroke="#e2a768" stroke-width="7" fill="none" stroke-linecap="round"/>
          <!-- 耳朵 -->
          <path d="M22 40 L26 14 L44 30 Z" fill="#e2a768"/>
          <path d="M78 40 L74 14 L56 30 Z" fill="#e2a768"/>
          <path d="M27 34 L29 21 L38 30 Z" fill="#f7c9c4"/>
          <path d="M73 34 L71 21 L62 30 Z" fill="#f7c9c4"/>
          <!-- 身體 -->
          <ellipse cx="50" cy="60" rx="34" ry="32" fill="#e2a768"/>
          <ellipse cx="50" cy="72" rx="20" ry="16" fill="#fffaf3"/>
          <!-- 條紋 -->
          <path d="M38 32 L41 39 M62 32 L59 39" stroke="#c98a52" stroke-width="3" stroke-linecap="round"/>
          <!-- 白色額頭與嘴邊 -->
          <path d="M44 30 Q50 26 56 30 L54 50 Q50 52 46 50 Z" fill="#fffaf3"/>
          <ellipse cx="50" cy="64" rx="14" ry="10" fill="#fffaf3"/>
          <!-- 臉 -->
          <ellipse class="eye" cx="38" cy="54" rx="3.4" ry="4.4" fill="#2b2a28"/>
          <ellipse class="eye" cx="62" cy="54" rx="3.4" ry="4.4" fill="#2b2a28"/>
          <circle cx="30" cy="62" r="4.5" fill="#f7a39a" opacity=".7"/>
          <circle cx="70" cy="62" r="4.5" fill="#f7a39a" opacity=".7"/>
          <path d="M47 60 L53 60 L50 63 Z" fill="#e0605a"/>
          <path d="M44 65 Q47 68 50 65 Q53 68 56 65" stroke="#2b2a28" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M20 58 L32 60 M20 64 L32 63 M80 58 L68 60 M80 64 L68 63" stroke="#8a5a2b" stroke-width="1.5" stroke-linecap="round"/>
          <!-- 小葉子 -->
          <path d="M50 26 Q56 14 66 16 Q60 26 50 26 Z" fill="#6cbf6a"/>
          <!-- 手 -->
          <circle cx="24" cy="80" r="7" fill="#fffaf3" stroke="#e2a768" stroke-width="2"/>
          <circle cx="76" cy="80" r="7" fill="#fffaf3" stroke="#e2a768" stroke-width="2"/>
        ` }
};
if (!MASCOTS[state.mascot]) state.mascot = "snow";
function renderMascot() {
  const m = MASCOTS[state.mascot];
  $("mascotArt").innerHTML = `<g class="body">${m.art}</g>`;
  $("mascotArt").setAttribute("aria-label", `吉祥物 ${m.name}`);
  const tag = $("mascotName"); tag.textContent = m.name; tag.style.background = m.color;
  $("picker").innerHTML = Object.entries(MASCOTS).map(([k, v]) =>
    `<button data-k="${k}" class="${k === state.mascot ? "on" : ""}" aria-pressed="${k === state.mascot}">
      <svg viewBox="0 0 100 100">${v.art}</svg>${v.name}</button>`).join("");
}
$("picker").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || b.dataset.k === state.mascot) return;
  state.mascot = b.dataset.k; save(); renderMascot(); hop();
  say(`嗨 ${state.user}，我是 ${MASCOTS[state.mascot].name}！`);
});
renderMascot();

renderCal(); tick(); setInterval(tick, 1000);