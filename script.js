(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) root.classList.add("paused");
  try { history.scrollRestoration = "manual"; } catch (e) {}

  // Translated UI strings (falls back to English if i18n.js is missing)
  function tr(key, fallback) {
    return (window.I18N && window.I18N.t(key)) || fallback;
  }

  // ---------- swipe helper (theme, language) ----------
  // The new state swipes in over the old one using the View Transitions API.
  // Browsers without it, reduced motion and paused animations just switch instantly.
  var busy = false;
  function canAnimate() {
    return !!document.startViewTransition && !reduce && !root.classList.contains("paused");
  }
  function wipe(update) {
    if (!canAnimate()) { update(); return; }
    if (busy) return;
    busy = true;
    root.classList.add("vt-wipe");
    var vt = document.startViewTransition(update);
    function done() { root.classList.remove("vt-wipe"); busy = false; }
    vt.finished.then(done, done);
  }

  // Theme toggle (remembered in the browser)
  var tb = document.querySelector(".theme-btn");
  if (tb) {
    tb.addEventListener("click", function () {
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      wipe(function () {
        root.dataset.theme = next;
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    });
  }

  // Language switch: same swipe as the theme
  document.querySelectorAll(".lang-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!window.I18N) return;
      var next = window.I18N.lang === "ru" ? "en" : "ru";
      wipe(function () { window.I18N.set(next); });
    });
  });

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
  function closeMenu() {
    if (nav) nav.classList.remove("open");
    document.body.classList.remove("menu-open");
    if (mb) mb.setAttribute("aria-expanded", "false");
    refreshLabels();
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

  // Reveal on scroll (also used again after a page change)
  var io = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
  }
  function observeReveals() {
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
      if (io) io.observe(el); else el.classList.add("in");
    });
  }
  observeReveals();

  // ---------- page changes: the page zooms out and swipes left, the next one swipes in ----------
  // Pages are fetched and the <main> block is swapped inside a view transition.
  // If anything is unsupported (or animations are paused) links just work as normal links.
  var cache = {};
  var curPath = location.pathname;

  function pageFile(u) { return u.pathname.split("/").pop() || "index.html"; }
  function isPage(u) { return /\.html$|\/$/.test(u.pathname); }

  function prefetch(href) {
    if (!cache[href]) {
      cache[href] = fetch(href).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
      cache[href].catch(function () { delete cache[href]; });
    }
    return cache[href];
  }

  function swapPage(doc, url) {
    var main = document.querySelector("main");
    main.replaceWith(document.importNode(doc.querySelector("main"), true));

    var page = doc.documentElement.getAttribute("data-page");
    if (page) root.setAttribute("data-page", page);

    var file = pageFile(url);
    document.querySelectorAll("#nav a").forEach(function (a) {
      if (pageFile(new URL(a.getAttribute("href"), url)) === file) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    var md = doc.querySelector('meta[name="description"]');
    if (window.I18N) {
      window.I18N.refresh({ title: doc.title, desc: md ? md.getAttribute("content") : "" });
    } else {
      document.title = doc.title;
    }

    closeMenu();
    document.body.classList.remove("cursor-hover", "cursor-down");
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    observeReveals();
    onScroll();

    // the demo bot on the Play page has its own script
    if (document.getElementById("chat")) {
      if (window.initPlay) {
        window.initPlay();
      } else if (!document.querySelector('script[src="play.js"]')) {
        var s = document.createElement("script");
        s.src = "play.js";
        document.body.appendChild(s);
      }
    }
  }

  function go(url, push, back) {
    if (busy) return;
    busy = true;
    prefetch(url.href).then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc.querySelector("main")) throw new Error("no main");
      root.classList.toggle("vt-back", !!back);
      var vt = document.startViewTransition(function () {
        if (push) history.pushState(null, "", url.href);
        curPath = url.pathname;
        swapPage(doc, url);
      });
      return vt.finished;
    }).catch(function () {
      location.href = url.href; // something went wrong: do a normal page load
    }).then(function () {
      root.classList.remove("vt-back");
      busy = false;
    });
  }

  function internal(a) {
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !isPage(url) || url.pathname === location.pathname) return null;
    return url;
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var url = internal(a);
    if (!url || !canAnimate()) return;
    e.preventDefault();
    go(url, true, false);
  });

  // load the next page while the pointer is over its link, so the swipe starts at once
  function warm(e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !canAnimate()) return;
    var url = internal(a);
    if (url) prefetch(url.href).catch(function () {});
  }
  document.addEventListener("mouseover", warm, { passive: true });
  document.addEventListener("touchstart", warm, { passive: true });

  // back / forward buttons
  window.addEventListener("popstate", function () {
    if (location.pathname === curPath) return; // only the #hash changed
    var url = new URL(location.href);
    if (!canAnimate()) { location.reload(); return; }
    go(url, false, true);
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

    var mx = -100, my = -100, rx = -100, ry = -100, running = false, pointerSeen = false;

    var frame = function () {
      var k = root.classList.contains("paused") ? 1 : 0.18;
      rx += (mx - rx) * k;
      ry += (my - ry) * k;
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      if (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) {
        requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
      if (!pointerSeen) {
        pointerSeen = true;
        rx = mx;
        ry = my;
      }
      document.body.classList.add("cursor-on");
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }, { passive: true });

    document.addEventListener("mouseleave", function () { document.body.classList.remove("cursor-on"); });

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
    var visited = false;
    try { visited = sessionStorage.getItem("seen"); } catch (e) {}
    if (visited || reduce) {
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
