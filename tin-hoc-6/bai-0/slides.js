/* BÀI 0 — WELCOME TO INFORMATICS
   Classroom navigation + progressive reveal. No backend, offline. */
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

  function updateHud() {
    tkEls.forEach(function (t, i) {
      t.className = "tk" + (i < current ? " done" : i === current ? " cur" : "");
    });
    counter.textContent = pad(current + 1) + " / " + pad(total);
    partLabel.textContent = slides[current].getAttribute("data-part") || "";
    revealHint.hidden = !hasHiddenSteps(slides[current]);
    // navigation hint only on the opening slide, so it never distracts students
    if (help) help.hidden = current !== 0;
  }

  /* ---------- steps ---------- */
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
    // Journey map: light up a group of stops
    var grp = stepEl.getAttribute("data-reveal-grp");
    if (grp) {
      slide.querySelectorAll('.stop[data-grp="' + grp + '"]').forEach(function (s) {
        s.classList.add("on");
      });
    }
    // Scenario: mark the correct choice
    if (stepEl.hasAttribute("data-answer")) {
      var box = slide.querySelector("[data-scenario]");
      if (box) {
        var right = box.querySelector("[data-correct]");
        if (right) right.classList.add("correct");
      }
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
    // advance a reveal step first; otherwise go to next slide
    if (revealNext(slides[current])) return;
    show(current + 1);
  }
  function prev() {
    show(current - 1);
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
        var exit = d.exitFullscreen || d.webkitExitFullscreen;
        if (exit) { var q = exit.call(d); if (q && q.catch) q.catch(function () {}); }
      }
    } catch (err) { /* fullscreen not available in this context */ }
  }
  // keep the 16:9 stage fitted after entering/exiting fullscreen
  document.addEventListener("fullscreenchange", function () { setTimeout(fit, 60); });
  document.addEventListener("webkitfullscreenchange", function () { setTimeout(fit, 60); });

  /* ---------- keyboard (wireless-presenter friendly) ----------
     NEXT is reveal-aware: it advances the next progressive step and only
     changes slide once every step on the current slide has been shown.
     Presenter remotes usually emit PageDown / PageUp (and sometimes arrows). */
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      // NEXT — reveal-aware
      case "ArrowRight":
      case "PageDown":
      case "ArrowDown":
      case " ":
      case "Spacebar":
      case "Enter":
        e.preventDefault(); next(); break;
      // PREVIOUS — plain slide back
      case "ArrowLeft":
      case "PageUp":
      case "ArrowUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); show(0); break;
      case "End":
        e.preventDefault(); show(total - 1); break;
      case "f":
      case "F":
        e.preventDefault(); toggleFullscreen(); break;
      // Escape: let the browser handle native fullscreen exit
    }
  });

  /* ---------- mouse ---------- */
  stage.addEventListener("click", function (e) {
    if (e.target.closest("[data-scenario] .choice")) return; // handled below
    if (e.target.closest("#hud") || e.target.closest("#help")) return;
    next();
  });

  /* ---------- scenario choice picking (visual only) ---------- */
  document.querySelectorAll("[data-scenario]").forEach(function (box) {
    box.querySelectorAll(".choice").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        box.querySelectorAll(".choice").forEach(function (b) { b.classList.remove("picked"); });
        btn.classList.add("picked");
      });
    });
  });

  /* ---------- init ---------- */
  slides[0].classList.add("active");
  updateHud();
})();
