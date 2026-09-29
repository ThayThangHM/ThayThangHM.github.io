/* BÀI 4 — MẠNG XÃ HỘI VÀ MỘT SỐ KÊNH TRAO ĐỔI THÔNG TIN TRÊN INTERNET
   Tin học 7 · KNTT. Classroom deck: offline, 16:9, wireless-presenter friendly.
   NEXT is reveal-aware: it shows the next .step, and only changes slide when
   every required step on the current slide is visible.
   Font-size zoom: a slider sets --zoom on <html>; every slide's .slide-z wrapper
   uses CSS `zoom` so text really reflows bigger and the slide scrolls if needed. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var ticks = document.getElementById("ticks");
  var counter = document.getElementById("counter");
  var partLabel = document.getElementById("part-label");
  var revealHint = document.getElementById("reveal-hint");
  var help = document.getElementById("help");

  var current = 0;
  var total = slides.length;

  /* ---------- 16:9 stage scaling (fits any resolution) ---------- */
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = "scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- progress ticks ---------- */
  slides.forEach(function () {
    var d = document.createElement("div");
    d.className = "tk";
    ticks.appendChild(d);
  });
  var tkEls = Array.prototype.slice.call(ticks.children);

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function updateHud() {
    tkEls.forEach(function (t, i) {
      t.className = "tk" + (i < current ? " done" : i === current ? " cur" : "");
    });
    counter.textContent = pad(current + 1) + " / " + pad(total);
    partLabel.textContent = slides[current].getAttribute("data-part") || "";
    revealHint.hidden = !hasHiddenSteps(slides[current]);
    if (help) help.hidden = current !== 0;
    slides[current].scrollTop = 0;
  }

  /* ---------- progressive steps ---------- */
  function steps(slide) {
    return Array.prototype.slice.call(slide.querySelectorAll(".step"));
  }
  function hasHiddenSteps(slide) {
    return steps(slide).some(function (el) { return el.hidden; });
  }
  function revealNext(slide) {
    var next = steps(slide).filter(function (el) { return el.hidden; })[0];
    if (!next) return false;
    next.hidden = false;
    applyStepSideEffects(slide, next);
    revealHint.hidden = !hasHiddenSteps(slide);
    return true;
  }

  function applyStepSideEffects(slide, stepEl) {
    var swap = stepEl.getAttribute("data-swap");
    if (swap) {
      var parts = swap.split("|");
      var img = document.getElementById(parts[0]);
      if (img && parts[1]) { img.src = parts[1]; img.classList.add("swapped"); }
    }
    if (stepEl.hasAttribute("data-answer")) {
      var box = slide.querySelector("[data-quiz]");
      if (box) {
        var right = box.querySelectorAll("[data-correct]");
        right.forEach(function (r) { r.classList.add("correct"); });
        box.classList.add("locked");
      }
    }
    var grp = stepEl.getAttribute("data-lightup");
    if (grp) {
      slide.querySelectorAll('[data-kind="' + grp + '"]').forEach(function (c) {
        c.classList.add("on");
      });
    }
  }

  /* ---------- navigation ---------- */
  function show(i) {
    if (i < 0 || i >= total) return;
    slides[current].classList.remove("active");
    current = i;
    slides[current].classList.add("active");
    updateHud();
  }
  function next() {
    if (revealNext(slides[current])) return;
    show(current + 1);
  }
  function prev() { show(current - 1); }

  /* ---------- fullscreen ---------- */
  function toggleFullscreen() {
    var d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        var el = d.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) { var p = req.call(el); if (p && p.catch) p.catch(function () {}); }
      } else {
        var exit = d.exitFullscreen || d.webkitExitFullscreen;
        if (exit) { var q = exit.call(d); if (q && q.catch) q.catch(function () {}); }
      }
    } catch (err) { /* not available */ }
  }
  document.addEventListener("fullscreenchange", function () { setTimeout(fit, 60); });
  document.addEventListener("webkitfullscreenchange", function () { setTimeout(fit, 60); });
  var fsBtn = document.getElementById("fsBtn");
  if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);

  /* ---------- zoom (font-size slider) ---------- */
  var ZMIN = 100, ZMAX = 160, ZSTEP = 5, ZKEY = "th7SlideZoom";
  var root = document.documentElement;
  var zRange = document.getElementById("zRange");
  var zVal = document.getElementById("zVal");
  var zMinus = document.getElementById("zMinus");
  var zPlus = document.getElementById("zPlus");
  var zReset = document.getElementById("zReset");

  function clampZ(n) { return Math.max(ZMIN, Math.min(ZMAX, n)); }
  function applyZoom(pct, save) {
    pct = clampZ(Math.round(pct / ZSTEP) * ZSTEP);
    root.style.setProperty("--zoom", (pct / 100).toFixed(2));
    if (zRange) zRange.value = pct;
    if (zVal) zVal.textContent = pct + "%";
    if (save !== false) {
      try { localStorage.setItem(ZKEY, String(pct)); } catch (e) { /* ignore */ }
    }
  }
  function storedZoom() {
    try {
      var v = parseInt(localStorage.getItem(ZKEY), 10);
      if (!isNaN(v)) return clampZ(v);
    } catch (e) { /* ignore */ }
    return 100;
  }
  applyZoom(storedZoom(), false);

  if (zRange) zRange.addEventListener("input", function () { applyZoom(parseInt(zRange.value, 10)); });
  if (zMinus) zMinus.addEventListener("click", function () { applyZoom(parseInt(zRange.value, 10) - ZSTEP); });
  if (zPlus) zPlus.addEventListener("click", function () { applyZoom(parseInt(zRange.value, 10) + ZSTEP); });
  if (zReset) zReset.addEventListener("click", function () { applyZoom(100); });

  /* ---------- keyboard (wireless presenter + zoom shortcuts) ---------- */
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var isRange = t && t.tagName === "INPUT" && t.type === "range";
    var typing = t && !isRange && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (typing) return;

    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
      case "Spacebar":
      case "Enter":
        if (isRange) return;
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "PageUp":
        if (isRange) return;
        e.preventDefault(); prev(); break;
      case "ArrowDown":
        if (isRange) return;
        e.preventDefault(); next(); break;
      case "ArrowUp":
        if (isRange) return;
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); show(0); break;
      case "End":
        e.preventDefault(); show(total - 1); break;
      case "f":
      case "F":
        e.preventDefault(); toggleFullscreen(); break;
      case "+":
      case "=":
        e.preventDefault(); applyZoom(parseInt(zRange.value, 10) + ZSTEP); break;
      case "-":
      case "_":
        e.preventDefault(); applyZoom(parseInt(zRange.value, 10) - ZSTEP); break;
      case "0":
        e.preventDefault(); applyZoom(100); break;
    }
  });

  /* ---------- mouse: click advances, except on quiz choices / HUD / zoombar ---------- */
  stage.addEventListener("click", function (e) {
    if (e.target.closest("[data-quiz] .choice")) return;
    if (e.target.closest("#hud") || e.target.closest("#help")) return;
    next();
  });

  /* ---------- quiz choice picking (visual only) ---------- */
  document.querySelectorAll("[data-quiz]").forEach(function (box) {
    box.querySelectorAll(".choice").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (box.classList.contains("locked")) return;
        if (box.hasAttribute("data-multi")) {
          btn.classList.toggle("picked");
        } else {
          box.querySelectorAll(".choice").forEach(function (b) { b.classList.remove("picked"); });
          btn.classList.add("picked");
        }
      });
    });
  });

  /* ---------- init ---------- */
  slides[0].classList.add("active");
  updateHud();
})();
