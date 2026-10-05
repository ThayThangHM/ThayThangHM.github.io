/* TIN HỌC 8 · SlideHTML framework v3 — navigation, reveal, zoom, timer. Offline, no backend.
   Wireless-presenter friendly:
     NEXT  = → PageDown ↓ Space Enter  (reveals the next .step; if the zoomed slide is taller than
             the screen, scrolls down first; only then goes to the next slide)
     PREV  = ← PageUp ↑                (previous slide)
     Home/End = first/last · F = fullscreen · + / − / 0 = zoom in / out / reset · Z = pin zoom bar
   Zoom: --zoom on <html>; every .slide-z uses CSS `zoom`, so text really reflows bigger.
   URL: #7 opens slide 7 (kept in sync, so a reload stays on the same slide).
   QA mode (for testing only): ?qa=1&z=130 → all steps revealed, zoom forced, overflow report in <body data-qa>. */
(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var ticks = document.getElementById("ticks");
  var counter = document.getElementById("counter");
  var partLabel = document.getElementById("part-label");
  var revealHint = document.getElementById("reveal-hint");
  var moreHint = document.getElementById("more-hint");
  var help = document.getElementById("help");
  var params = new URLSearchParams(location.search);
  var QA = params.get("qa") === "1";

  var current = 0;
  var total = slides.length;

  /* ---------- 16:9 stage scaling ---------- */
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

  function belowFold(slide) {
    // count a smooth scroll still in progress as already done (fast presenter clicks)
    var top = Math.max(slide.scrollTop, slide._target || 0);
    return top + slide.clientHeight < slide.scrollHeight - 6;
  }
  function updateMore() {
    if (moreHint) moreHint.hidden = !belowFold(slides[current]);
  }

  function updateHud() {
    tkEls.forEach(function (t, i) {
      t.className = "tk" + (i < current ? " done" : i === current ? " cur" : "");
    });
    counter.textContent = pad(current + 1) + " / " + pad(total);
    partLabel.textContent = slides[current].getAttribute("data-part") || "";
    revealHint.hidden = !hasHiddenSteps(slides[current]);
    if (help) help.hidden = current !== 0;
    updateMore();
  }

  /* ---------- progressive steps ---------- */
  function steps(slide) {
    return Array.prototype.slice.call(slide.querySelectorAll(".step"));
  }
  function hasHiddenSteps(slide) {
    return steps(slide).some(function (el) { return el.hidden; });
  }
  function revealNext(slide) {
    var el = steps(slide).filter(function (s) { return s.hidden; })[0];
    if (!el) return false;
    el.hidden = false;
    applyStepSideEffects(slide, el);
    revealHint.hidden = !hasHiddenSteps(slide);
    // keep the newly revealed content on screen (matters when zoomed in)
    setTimeout(function () {
      var sr = slide.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (er.bottom > sr.bottom - 4 || er.top < sr.top) {
        try { el.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { el.scrollIntoView(false); }
      }
      updateMore();
    }, 40);
    return true;
  }

  function applyStepSideEffects(slide, el) {
    // quiz: reveal the correct answer(s) and lock the choices
    if (el.hasAttribute("data-answer")) {
      var box = slide.querySelector("[data-quiz]");
      if (box) {
        box.querySelectorAll("[data-correct]").forEach(function (r) { r.classList.add("correct"); });
        box.classList.add("locked");
      }
    }
    // light up / mark elements: data-mark="selector|class"
    var mark = el.getAttribute("data-mark");
    if (mark) {
      var p = mark.split("|");
      slide.querySelectorAll(p[0]).forEach(function (n) { n.classList.add(p[1] || "on"); });
    }
    // countdown timer
    var tm = el.classList.contains("timer") ? el : el.querySelector(".timer");
    if (tm) startTimer(tm);
  }

  /* ---------- navigation ---------- */
  function show(i) {
    if (i < 0 || i >= total) return;
    slides[current].classList.remove("active");
    current = i;
    slides[current].classList.add("active");
    slides[current].scrollTop = 0;
    slides[current]._target = 0;
    updateHud();
    if (!QA) { try { history.replaceState(null, "", "#" + (current + 1)); } catch (e) { /* file:// */ } }
  }
  function next() {
    var s = slides[current];
    if (revealNext(s)) return;
    if (belowFold(s)) {
      var from = Math.max(s.scrollTop, s._target || 0);
      s._target = Math.min(from + s.clientHeight * 0.8, s.scrollHeight - s.clientHeight);
      s.scrollTo({ top: s._target, behavior: "smooth" });
      return;
    }
    show(current + 1);
  }
  function prev() { show(current - 1); }

  slides.forEach(function (s) {
    s.addEventListener("scroll", function () {
      if (s._target != null && Math.abs(s.scrollTop - s._target) < 2) s._target = null;
      if (s === slides[current]) updateMore();
    });
    s.addEventListener("wheel", function () { s._target = null; }, { passive: true });
  });

  /* ---------- countdown timer (.timer[data-min]) — click to pause/resume ---------- */
  function startTimer(tm) {
    if (tm._running) return;
    var secs = Math.round(parseFloat(tm.getAttribute("data-min") || "5") * 60);
    var out = tm.querySelector(".t");
    tm._left = tm._left != null ? tm._left : secs;
    tm._running = true;
    function paint() {
      var m = Math.floor(tm._left / 60), s = tm._left % 60;
      out.textContent = m + ":" + (s < 10 ? "0" : "") + s;
      tm.classList.toggle("low", tm._left <= 60 && tm._left > 0);
      tm.classList.toggle("done", tm._left <= 0);
    }
    paint();
    tm._iv = setInterval(function () {
      if (tm._paused) return;
      if (tm._left > 0) tm._left--;
      paint();
      if (tm._left <= 0) clearInterval(tm._iv);
    }, 1000);
    tm.addEventListener("click", function (e) {
      e.stopPropagation();
      tm._paused = !tm._paused;
      tm.classList.toggle("paused", tm._paused);
    });
  }

  /* ---------- fullscreen ---------- */
  function toggleFullscreen() {
    var d = document;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        var el = d.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) { var p = req.call(el); if (p && p.catch) p.catch(function () {}); }
      } else {
        var ex = d.exitFullscreen || d.webkitExitFullscreen;
        if (ex) { var q = ex.call(d); if (q && q.catch) q.catch(function () {}); }
      }
    } catch (err) { /* not available */ }
  }
  document.addEventListener("fullscreenchange", function () { setTimeout(fit, 60); });
  document.addEventListener("webkitfullscreenchange", function () { setTimeout(fit, 60); });
  var fsBtn = document.getElementById("fsBtn");
  if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);

  /* ---------- zoom ---------- */
  var ZMIN = 80, ZMAX = 170, ZSTEP = 10, ZDEF = 100, ZKEY = "th8SlideZoom";
  var root = document.documentElement;
  var zoombar = document.getElementById("zoombar");
  var zRange = document.getElementById("zRange");
  var zVal = document.getElementById("zVal");
  var zPin = document.getElementById("zPin");
  var toast = document.getElementById("ztoast");
  var zoomNow = ZDEF;

  function clampZ(n) { return Math.max(ZMIN, Math.min(ZMAX, n)); }
  function applyZoom(pct, save) {
    pct = clampZ(Math.round(pct / ZSTEP) * ZSTEP);
    zoomNow = pct;
    root.style.setProperty("--zoom", (pct / 100).toFixed(2));
    root.classList.toggle("zoom-hi", pct >= 140);
    root.classList.toggle("zoomed", pct !== ZDEF);
    if (zRange) zRange.value = pct;
    if (zVal) zVal.textContent = pct + "%";
    if (save !== false) { try { localStorage.setItem(ZKEY, String(pct)); } catch (e) { /* ignore */ } }
    slides[current].scrollTop = 0;
    slides[current]._target = 0;
    setTimeout(updateMore, 30);
  }
  function storedZoom() {
    try {
      var v = parseInt(localStorage.getItem(ZKEY), 10);
      if (!isNaN(v)) return clampZ(v);
    } catch (e) { /* ignore */ }
    return ZDEF;
  }
  var toastT;
  function flash(txt) {
    if (!toast) return;
    toast.textContent = txt;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("show"); }, 1100);
  }
  var barT;
  function wakeBar() {
    if (!zoombar) return;
    zoombar.classList.add("show");
    clearTimeout(barT);
    barT = setTimeout(function () { if (!zoombar.matches(":hover")) zoombar.classList.remove("show"); }, 2500);
  }
  function zoomBy(d) { applyZoom(zoomNow + d); flash("Zoom " + zoomNow + "%"); }

  applyZoom(params.get("z") ? parseInt(params.get("z"), 10) : storedZoom(), false);
  if (zRange) zRange.addEventListener("input", function () { applyZoom(parseInt(zRange.value, 10)); });
  document.getElementById("zMinus").addEventListener("click", function () { zoomBy(-ZSTEP); });
  document.getElementById("zPlus").addEventListener("click", function () { zoomBy(ZSTEP); });
  document.getElementById("zReset").addEventListener("click", function () { applyZoom(ZDEF); flash("Zoom " + ZDEF + "%"); });
  if (zPin) zPin.addEventListener("click", function () {
    zoombar.classList.toggle("pinned");
    zPin.classList.toggle("on", zoombar.classList.contains("pinned"));
  });
  document.addEventListener("mousemove", wakeBar);
  if (zoombar) zoombar.addEventListener("mouseleave", wakeBar);

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var isRange = t && t.tagName === "INPUT" && t.type === "range";
    if (t && !isRange && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    switch (e.key) {
      case "ArrowRight": case "PageDown": case "ArrowDown":
      case " ": case "Spacebar": case "Enter":
        e.preventDefault(); if (isRange) t.blur(); next(); break;
      case "ArrowLeft": case "PageUp": case "ArrowUp":
        e.preventDefault(); if (isRange) t.blur(); prev(); break;
      case "Home": e.preventDefault(); show(0); break;
      case "End": e.preventDefault(); show(total - 1); break;
      case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
      case "+": case "=": e.preventDefault(); zoomBy(ZSTEP); wakeBar(); break;
      case "-": case "_": e.preventDefault(); zoomBy(-ZSTEP); wakeBar(); break;
      case "0": e.preventDefault(); applyZoom(ZDEF); flash("Zoom " + ZDEF + "%"); wakeBar(); break;
      case "z": case "Z": if (zPin) zPin.click(); break;
    }
  });

  /* ---------- mouse: click advances, except on interactive bits ---------- */
  stage.addEventListener("click", function (e) {
    if (e.target.closest("[data-quiz] .choice") || e.target.closest(".timer")) return;
    if (e.target.closest("#hud") || e.target.closest("#help")) return;
    next();
  });

  /* ---------- quiz choice picking (visual only; NEXT reveals the answer) ---------- */
  document.querySelectorAll("[data-quiz]").forEach(function (box) {
    box.querySelectorAll(".choice").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (box.classList.contains("locked")) return;
        box.querySelectorAll(".choice").forEach(function (b) { b.classList.remove("picked"); });
        btn.classList.add("picked");
      });
    });
  });

  /* ---------- init ---------- */
  // every .step starts hidden (authors only add class="step"; without JS everything stays visible)
  if (!QA) document.querySelectorAll(".step").forEach(function (el) { el.hidden = true; });
  window.addEventListener("hashchange", function () {
    var n = parseInt((location.hash || "").replace("#", ""), 10);
    if (!isNaN(n) && n - 1 !== current) show(n - 1);
  });
  var start = parseInt((location.hash || "").replace("#", ""), 10);
  slides.forEach(function (s) { s.classList.remove("active"); });
  current = !isNaN(start) && start >= 1 && start <= total ? start - 1 : 0;
  slides[current].classList.add("active");
  updateHud();

  /* ---------- QA: reveal everything and report overflow per slide ---------- */
  if (QA) {
    slides.forEach(function (s) { steps(s).forEach(function (el) { el.hidden = false; }); });
    var rep = [];
    slides.forEach(function (s, i) {
      s.classList.add("active");
      var z = s.querySelector(".slide-z");
      var over = s.scrollHeight - s.clientHeight;
      var wide = z ? z.scrollWidth - z.clientWidth : 0;
      // any element whose right edge pokes out of the slide
      var sr = s.getBoundingClientRect(), bad = 0;
      s.querySelectorAll(".slide-z *").forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.width && r.right > sr.right + 2) bad++;
      });
      rep.push((i + 1) + ":" + over + "/" + wide + "/" + bad);
      if (i !== current) s.classList.remove("active");
    });
    document.body.setAttribute("data-qa", rep.join(" "));
  }
})();
