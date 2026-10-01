/* THẦY THẮNG AI (AI giảng bài) — phát lời giảng MP3 tạo sẵn cho slide đang chiếu; hết lời giảng thì tự sang slide sau.
   Tự chứa, KHÔNG sửa slides.js: theo dõi .slide.active để biết slide đổi, và điều khiển slide bằng
   phím ảo → / ← y như người dùng bấm (nên dùng được với mọi phiên bản slides.js).
   Dữ liệu: window.NARRATION_DATA trong narration/narration-data.js (nạp TRƯỚC file này), tạo bằng
   scripts/generate-narration.py từ narration/script.json. Không có dữ liệu → không hiện gì, slide chạy như cũ.
   Mỗi slide là một dãy: {audio:"narration/audio/slide-03.mp3"} · {pause:5} (đếm giây) · {step:1} (hiện bước tiếp).
   Phím N = bật / tạm dừng / tiếp tục. Chạy được qua file:// (không dùng fetch). */
(function () {
  "use strict";

  var DATA = window.NARRATION_DATA;
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  if (!DATA || !DATA.slides || !slides.length) return;

  var SPEEDS = [0.8, 1, 1.2, 1.5];
  var GAP = 800;            // ms nghỉ trước khi sang slide sau
  var NO_AUDIO_WAIT = 3000; // slide chưa có lời giảng: dừng lại cho xem rồi đi tiếp
  var PREF_KEY = "aiNarrationPrefs";

  var prefs = loadPrefs();
  var audio = new Audio();
  audio.preload = "auto";

  var on = false;      // chế độ AI giảng đang bật
  var paused = false;
  var cur = activeIndex();
  var items = [], pos = 0;
  var busy = null;     // "audio" | "wait" | null — việc đang dở ở items[pos]
  var token = 0;       // tăng mỗi khi đổi slide/dừng → bỏ qua callback cũ
  var waitLeft = 0, waitFn = null, waitLabel = "", waitLast = 0, waitIv = null;

  /* ---------------- slide helpers ---------------- */
  function activeIndex() {
    for (var i = 0; i < slides.length; i++) if (slides[i].classList.contains("active")) return i;
    return 0;
  }
  function key(k) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  }
  // Đi tới slide i bằng phím ảo. → còn bước ẩn thì hiện bước trước, nên bấm tới khi slide đổi.
  function goTo(i) {
    if (i < 0 || i >= slides.length) return;
    var guard = 0, before;
    while (activeIndex() > i && guard++ < 200) { before = activeIndex(); key("ArrowLeft"); if (activeIndex() === before) break; }
    while (activeIndex() < i && guard++ < 400) key("ArrowRight");
  }
  function revealStep() {
    // chỉ bấm → khi slide còn bước ẩn, nếu không sẽ nhảy sang slide khác
    if (slides[activeIndex()].querySelector(".step[hidden]")) key("ArrowRight");
  }

  /* ---------------- engine ---------------- */
  function clearWait() {
    clearInterval(waitIv);
    waitIv = null; waitFn = null;
  }
  // chờ ms (không chạy khi đang Pause), hiện đếm ngược nếu có nhãn
  function wait(ms, fn, label) {
    clearWait();
    var t = token;
    busy = "wait";
    waitLeft = ms; waitLabel = label || ""; waitLast = Date.now();
    waitFn = function () { if (t === token) fn(); };
    waitIv = setInterval(tick, 200);
    render();
  }
  function tick() {
    var now = Date.now();
    if (!paused) waitLeft -= now - waitLast;
    waitLast = now;
    if (waitLeft <= 0) { var f = waitFn; clearWait(); busy = null; if (f) f(); return; }
    if (waitLabel) setStatus(waitLabel + " " + Math.ceil(waitLeft / 1000) + "s");
  }

  function stopMedia() {
    token++;
    clearWait();
    audio.pause();
    if (audio.getAttribute("src")) { audio.removeAttribute("src"); audio.load(); }
    busy = null;
  }
  function loadSlide(i) {
    stopMedia();
    cur = i;
    items = DATA.slides[String(i + 1)] || [];
    pos = 0;
  }

  function run() {
    if (!on || paused) return;
    if (!items.length) {
      setStatus("Slide này chưa có lời giảng");
      return wait(NO_AUDIO_WAIT, finishSlide);
    }
    if (pos >= items.length) return finishSlide();
    var it = items[pos];
    if (it.audio) playClip(it.audio);
    else if (it.pause) wait(it.pause * 1000, advance, "⏳ Các em suy nghĩ…");
    else { if (it.step) revealStep(); advance(); }
  }
  function advance() { busy = null; pos++; run(); }

  function playClip(src) {
    var t = token;
    busy = "audio";
    audio.src = src;
    audio.defaultPlaybackRate = audio.playbackRate = prefs.speed;
    audio.volume = prefs.vol;
    var p = audio.play();
    if (p && p.catch) p.catch(function (e) {
      if (t !== token || (e && e.name === "AbortError")) return;
      if (e && e.name === "NotAllowedError") { paused = true; render(); setStatus("Bấm ▶ để nghe"); }
    });
    render();
  }
  audio.addEventListener("ended", function () { if (on && busy === "audio") advance(); });
  audio.addEventListener("error", function () {
    if (!on || busy !== "audio" || !audio.getAttribute("src")) return;
    busy = null;
    wait(1500, advance, "⚠ Thiếu file audio, bỏ qua…");
  });

  function finishSlide() {
    busy = null;
    if (cur >= slides.length - 1) {
      stop();
      setStatus("✅ Đã giảng hết bài");
      return;
    }
    wait(GAP, function () {
      var from = activeIndex();
      goTo(cur + 1);
      // phòng khi phím ảo không làm đổi slide (bản slides.js lạ): dừng hẳn thay vì lặp
      setTimeout(function () { if (on && activeIndex() === from) { stop(); setStatus("Không tự chuyển được slide"); } }, 300);
    });
  }

  // slide đổi (do người dùng hoặc do AI) → dừng audio cũ, nạp lời giảng slide mới
  function onSlideChange() {
    var i = activeIndex();
    if (i === cur) return;
    if (!on) { cur = i; return; }
    loadSlide(i);
    if (paused) { render(); setStatus("Đã tạm dừng — slide " + (i + 1)); }
    else run();
  }
  var mo = new MutationObserver(onSlideChange);
  slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ["class"] }); });

  /* ---------------- controls ---------------- */
  function start() {
    on = true; paused = false;
    setStatus("");
    loadSlide(activeIndex());
    run();
    render();
  }
  function stop() {
    stopMedia();
    on = false; paused = false;
    render();
  }
  function togglePause() {
    if (!on) return start();
    paused = !paused;
    if (paused) {
      if (busy === "audio") audio.pause();
      setStatus("Đã tạm dừng");
    } else if (busy === "audio") {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else if (busy !== "wait") run();
    render();
  }
  function setSpeed(s) {
    prefs.speed = s;
    audio.defaultPlaybackRate = audio.playbackRate = s;
    savePrefs(); render();
  }
  function setVol(v) {
    prefs.vol = v;
    audio.volume = v;
    savePrefs();
  }

  /* ---------------- UI ---------------- */
  var css = [
    "#narr{position:fixed;left:18px;bottom:52px;z-index:1000;display:flex;flex-wrap:wrap;align-items:center;gap:8px;",
    "max-width:calc(100vw - 36px);font-family:var(--font,'Segoe UI',system-ui,sans-serif);color:#f4f1e8;transition:opacity .4s}",
    "#narr.idle{opacity:.4}#narr.idle:hover{opacity:1}",
    "#narr button{font-family:inherit;border:none;cursor:pointer;color:#f4f1e8;background:rgba(255,255,255,.14);border-radius:999px;",
    "height:38px;min-width:38px;padding:0 10px;font-size:16px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px}",
    "#narr button:hover{background:rgba(255,255,255,.28)}",
    "#narr .nr-main{background:rgba(18,35,59,.9);box-shadow:0 6px 22px rgba(0,0,0,.35);padding:0 16px 0 12px;height:42px}",
    "#narr .nr-main:hover{background:rgba(31,111,139,.95)}",
    "#narr .nr-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:rgba(18,35,59,.92);border-radius:24px;",
    "padding:6px 10px;box-shadow:0 6px 22px rgba(0,0,0,.35)}",
    "#narr .nr-play{background:var(--amber,#e8963c);color:#fff;width:46px}",
    "#narr .nr-play:hover{background:#f0a650}",
    "#narr .nr-sep{width:1px;height:22px;background:rgba(255,255,255,.22)}",
    "#narr .nr-sp{height:30px;min-width:0;padding:0 8px;font-size:14px;background:transparent}",
    "#narr .nr-sp.on{background:#f4f1e8;color:#12233b}",
    "#narr .nr-vol{display:inline-flex;align-items:center;gap:4px;font-size:16px}",
    "#narr .nr-vol input{width:80px;accent-color:var(--amber,#e8963c);cursor:pointer}",
    "#narr .nr-status{font-size:14px;font-weight:700;padding:0 6px;white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis}",
    "#narr .nr-stop{font-size:14px}",
    "#narr .nr-msg{background:rgba(18,35,59,.9);border-radius:999px;padding:8px 14px;font-size:14px;font-weight:700}",
    "#narr [hidden]{display:none!important}",
    "@media (max-width:700px){#narr{left:8px;bottom:8px;max-width:calc(100vw - 16px)}",
    "#narr .nr-vol{display:none}#narr .nr-status{max-width:150px;font-size:13px}#narr button{height:34px;min-width:34px}}"
  ].join("");
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var box = document.createElement("div");
  box.id = "narr";
  box.innerHTML =
    '<button class="nr-main" type="button" title="Thầy Thắng AI giảng bài từ slide đang xem (phím N)">▶ 🎙 Thầy Thắng AI</button>' +
    '<span class="nr-msg" hidden></span>' +
    '<div class="nr-bar" hidden>' +
      '<button type="button" data-a="prev" title="Slide trước">⏮</button>' +
      '<button type="button" data-a="toggle" class="nr-play" title="Tạm dừng / tiếp tục (N)">⏸</button>' +
      '<button type="button" data-a="next" title="Slide sau">⏭</button>' +
      '<span class="nr-sep"></span>' +
      '<label class="nr-vol" title="Âm lượng">🔊<input type="range" min="0" max="1" step="0.05" aria-label="Âm lượng"></label>' +
      SPEEDS.map(function (s) {
        return '<button type="button" class="nr-sp" data-speed="' + s + '" title="Tốc độ đọc ' + s + '×" aria-label="Tốc độ đọc ' + s + ' lần">' + s + "×</button>";
      }).join("") +
      '<span class="nr-sep"></span>' +
      '<span class="nr-status" aria-live="polite"></span>' +
      '<button type="button" data-a="stop" class="nr-stop" title="Tắt Thầy Thắng AI">✕</button>' +
    "</div>";
  document.body.appendChild(box);

  var mainBtn = box.querySelector(".nr-main");
  var bar = box.querySelector(".nr-bar");
  var playBtn = box.querySelector(".nr-play");
  var statusEl = box.querySelector(".nr-status");
  var msgEl = box.querySelector(".nr-msg");
  var volEl = box.querySelector(".nr-vol input");
  volEl.value = prefs.vol;

  // khi đang giảng: chữ trong thanh điều khiển; khi đã tắt (hết bài…): dòng nhỏ cạnh nút chính
  function setStatus(t) {
    statusEl.textContent = t;
    msgEl.textContent = t;
    msgEl.hidden = on || !t;
  }
  function render() {
    mainBtn.hidden = on;
    bar.hidden = !on;
    msgEl.hidden = on || !msgEl.textContent;
    playBtn.textContent = paused ? "▶" : "⏸";
    playBtn.title = paused ? "Tiếp tục (N)" : "Tạm dừng (N)";
    box.querySelectorAll(".nr-sp").forEach(function (b) {
      b.classList.toggle("on", parseFloat(b.getAttribute("data-speed")) === prefs.speed);
    });
    if (on && !paused && busy === "audio") setStatus("🎙 Slide " + (cur + 1) + "/" + slides.length + " · đang giảng");
    if (!on || paused) box.classList.remove("idle");
  }

  // không để click/phím trên thanh điều khiển lọt xuống slide
  box.addEventListener("click", function (e) {
    e.stopPropagation();
    var b = e.target.closest("button");
    if (!b) return;
    b.blur(); // để Space / → tiếp tục điều khiển slide
    if (b === mainBtn) return start();
    var sp = b.getAttribute("data-speed");
    if (sp) return setSpeed(parseFloat(sp));
    switch (b.getAttribute("data-a")) {
      case "toggle": togglePause(); break;
      case "prev": goTo(activeIndex() - 1); break;
      case "next": goTo(activeIndex() + 1); break;
      case "stop": stop(); setStatus(""); break;
    }
  });
  volEl.addEventListener("input", function () { setVol(parseFloat(volEl.value)); });
  volEl.addEventListener("change", function () { volEl.blur(); });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (e.ctrlKey || e.metaKey || e.altKey || !e.isTrusted) return;
    if (t && (t.tagName === "INPUT" && t.type !== "range" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "n" || e.key === "N") { e.preventDefault(); togglePause(); }
  });

  // đang giảng mà không động chuột → làm mờ thanh điều khiển cho đỡ che slide
  var idleT;
  function wake() {
    box.classList.remove("idle");
    clearTimeout(idleT);
    idleT = setTimeout(function () { if (on && !paused) box.classList.add("idle"); }, 3000);
  }
  document.addEventListener("mousemove", wake);
  document.addEventListener("touchstart", wake, { passive: true });

  /* ---------------- prefs ---------------- */
  function loadPrefs() {
    var p = { vol: 1, speed: 1 };
    try {
      var s = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      if (typeof s.vol === "number" && s.vol >= 0 && s.vol <= 1) p.vol = s.vol;
      if (SPEEDS.indexOf(s.speed) >= 0) p.speed = s.speed;
    } catch (e) { /* ignore */ }
    return p;
  }
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  render();

  // cho kiểm thử / gỡ lỗi từ console
  window.AINarration = {
    start: start, stop: stop, toggle: togglePause, setSpeed: setSpeed, audio: audio,
    state: function () {
      return { on: on, paused: paused, slide: cur + 1, item: pos, busy: busy, src: audio.getAttribute("src"),
               playing: !audio.paused, rate: audio.playbackRate, status: statusEl.textContent };
    }
  };
})();
