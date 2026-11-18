(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) root.classList.add("paused");

  // Theme toggle (remembered in the browser)
  var tb = document.querySelector(".theme-btn");
  if (tb) {
    tb.addEventListener("click", function () {
      var next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  // Mobile menu
  var mb = document.querySelector(".menu-btn");
  var nav = document.getElementById("nav");
  if (mb && nav) {
    mb.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      mb.setAttribute("aria-expanded", open);
      mb.textContent = open ? "Close" : "Menu";
    });
  }

  // Pause / play animations
  var pb = document.getElementById("pause");
  if (pb) {
    pb.addEventListener("click", function () {
      var paused = root.classList.toggle("paused");
      pb.textContent = paused ? "Play animations" : "Pause animations";
    });
  }

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

  // Page transition: a curtain wipes up with the name of the next page
  var curtain = document.createElement("div");
  curtain.className = "curtain";
  curtain.setAttribute("aria-hidden", "true");
  var clabel = document.createElement("span");
  curtain.appendChild(clabel);
  document.body.appendChild(curtain);

  var pageNames = {
    "index.html": "Home", "work.html": "Work", "about.html": "About",
    "notes.html": "Notes", "play.html": "Play", "contact.html": "Contact"
  };

  var incoming = null;
  try { incoming = sessionStorage.getItem("t"); } catch (e) {}
  if (incoming && !reduce) {
    try { sessionStorage.removeItem("t"); sessionStorage.setItem("seen", "1"); } catch (e) {}
    clabel.textContent = incoming;
    curtain.classList.add("start-covered");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        curtain.classList.remove("start-covered");
        curtain.classList.add("reveal-out");
        setTimeout(function () { curtain.classList.remove("reveal-out"); }, 900);
      });
    });
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || (a.target && a.target !== "_self")) return;
    var url = new URL(a.href, location.href);
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    if (url.pathname === location.pathname) return;
    if (reduce || root.classList.contains("paused")) return;
    e.preventDefault();
    var file = url.pathname.split("/").pop() || "index.html";
    var name = pageNames[file] || "";
    clabel.textContent = name;
    curtain.classList.add("cover");
    try { sessionStorage.setItem("t", name); } catch (err) {}
    setTimeout(function () { location.href = url.href; }, 650);
  });

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) curtain.classList.remove("cover");
  });

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
  }
})();
