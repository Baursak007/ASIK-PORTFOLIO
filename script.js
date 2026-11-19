(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) root.classList.add("paused");

  // Translated UI strings (falls back to English if i18n.js is missing)
  function tr(key, fallback) {
    return (window.I18N && window.I18N.t(key)) || fallback;
  }

  // Theme toggle (remembered in the browser)
  var tb = document.querySelector(".theme-btn");
  var swapping = false;
  if (tb) {
    tb.addEventListener("click", function () {
      if (swapping) return;
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      function apply() {
        root.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch (e) {}
      }
      // The new theme swipes in over the old one (View Transitions API).
      // Browsers without it, or reduced motion / paused animations, switch instantly.
      if (!document.startViewTransition || reduce || root.classList.contains("paused")) {
        apply();
        return;
      }
      swapping = true;
      root.classList.add("theme-swap");
      var vt = document.startViewTransition(apply);
      vt.finished.then(done, done);
      function done() {
        root.classList.remove("theme-swap");
        swapping = false;
      }
    });
  }

  // Mobile menu + pause button labels (they change with state and language)
  var mb = document.querySelector(".menu-btn");
  var nav = document.getElementById("nav");
  var pb = document.getElementById("pause");

  function refreshLabels() {
    if (mb && nav) {
      mb.textContent = nav.classList.contains("open") ? tr("close", "Close") : tr("menu", "Menu");
    }
    if (pb) {
      pb.textContent = root.classList.contains("paused") ? tr("play", "Play animations") : tr("pause", "Pause animations");
    }
  }

  if (mb && nav) {
    mb.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      document.body.classList.toggle("menu-open", open);
      mb.setAttribute("aria-expanded", open);
      refreshLabels();
    });
  }
  if (pb) {
    pb.addEventListener("click", function () {
      root.classList.toggle("paused");
      refreshLabels();
    });
  }
  document.addEventListener("langchange", refreshLabels);
  refreshLabels();

  // Live Astana clock
  var clock = document.getElementById("clock");
  function tick() {
    if (!clock) return;
    clock.textContent = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit"
    });
  }
  tick();
  setInterval(tick, 30000);

  // Scroll counter 000 / 100
  var sn = document.getElementById("scroll-n");
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.round((window.scrollY / h) * 100) : 0;
    if (sn) sn.textContent = String(p).padStart(3, "0");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Reveal on scroll
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add("in"); });
  }

  // Curtain: wipes up between pages and when the language changes
  var curtain = document.createElement("div");
  curtain.className = "curtain";
  curtain.setAttribute("aria-hidden", "true");
  var clabel = document.createElement("span");
  curtain.appendChild(clabel);
  document.body.appendChild(curtain);

  var pageKeys = {
    "index.html": "pg.home", "work.html": "pg.work", "about.html": "pg.about",
    "notes.html": "pg.notes", "play.html": "pg.play", "contact.html": "pg.contact"
  };
  var pageFallback = {
    "index.html": "Home", "work.html": "Work", "about.html": "About",
    "notes.html": "Notes", "play.html": "Play", "contact.html": "Contact"
  };

  function revealOut() {
    curtain.classList.remove("cover");
    curtain.classList.add("reveal-out");
    setTimeout(function () { curtain.classList.remove("reveal-out"); }, 900);
  }

  // Page changes are animated by the browser in CSS (cross-document view transitions, see
  // style.css): the old page zooms out and swipes left, the next one swipes in.
  // Browsers without support just open the next page.
  window.addEventListener("pageswap", function (e) {
    // "Pause animations" also stops the page transition
    if (e.viewTransition && root.classList.contains("paused")) e.viewTransition.skipTransition();
  });

  // Language switch: the curtain covers the page, the text changes underneath, then it lifts
  var switching = false;
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!window.I18N || switching) return;
      var next = window.I18N.lang === "ru" ? "en" : "ru";
      if (reduce || root.classList.contains("paused")) {
        window.I18N.set(next);
        return;
      }
      switching = true;
      clabel.textContent = next === "ru" ? "Русский" : "English";
      curtain.classList.add("cover");
      setTimeout(function () {
        window.I18N.set(next);
        revealOut();
        setTimeout(function () { switching = false; }, 800);
      }, 650);
    });
  });

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) curtain.classList.remove("cover");
  });

  // Cursor follower (mouse only): a dot that sticks to the pointer and a ring that trails it.
  // The ring grows when the pointer is over a link or button.
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && !reduce) {
    var dot = document.createElement("div");
    var ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    dot.setAttribute("aria-hidden", "true");
    ring.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.body.classList.add("has-cursor");

    var mx = -100, my = -100, rx = -100, ry = -100, running = false, seen = false;

    function frame() {
      var k = root.classList.contains("paused") ? 1 : 0.18;
      rx += (mx - rx) * k;
      ry += (my - ry) * k;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) {
        requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      if (!seen) {
        seen = true;
        rx = mx;
        ry = my;
        document.body.classList.add("cursor-on");
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }, { passive: true });

    document.addEventListener("mouseleave", function () { document.body.classList.remove("cursor-on"); seen = false; });
    document.addEventListener("mouseenter", function () { document.body.classList.add("cursor-on"); });

    var HOVER = "a, button, [role='button'], summary";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(HOVER)) document.body.classList.add("cursor-hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (!e.target.closest || !e.target.closest(HOVER)) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(HOVER)) return;
      document.body.classList.remove("cursor-hover");
    });
    document.addEventListener("mousedown", function () { document.body.classList.add("cursor-down"); });
    document.addEventListener("mouseup", function () { document.body.classList.remove("cursor-down"); });
  }

  // Loader (home page only, once per session)
  var ld = document.getElementById("loader");
  function ready() { document.body.classList.add("ready"); }
  if (ld) {
    var seen = false;
    try { seen = sessionStorage.getItem("seen"); } catch (e) {}
    if (seen || reduce) {
      ld.remove();
      ready();
    } else {
      var n = document.getElementById("loader-n");
      var v = 0;
      var t = setInterval(function () {
        v += Math.ceil(Math.random() * 7);
        if (v >= 100) {
          v = 100;
          clearInterval(t);
          setTimeout(function () {
            ld.classList.add("done");
            ready();
            try { sessionStorage.setItem("seen", "1"); } catch (e) {}
            setTimeout(function () { ld.remove(); }, 800);
          }, 250);
        }
        n.textContent = String(v).padStart(3, "0");
      }, 45);
    }
  } else {
    ready();
    // the intro counter is for the first page of a visit only
    try { sessionStorage.setItem("seen", "1"); } catch (e) {}
  }
})();
