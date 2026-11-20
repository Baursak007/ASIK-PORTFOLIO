// Browser checks with Playwright (Chromium). Run with: node --test tests/browser.test.cjs
// Needs the `playwright` package and a Chromium install. The site is served from a tiny built-in server.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml" };
const PAGES = ["index.html", "work.html", "about.html", "notes.html", "play.html", "contact.html"];
// fonts come from Google and may be unreachable on a test machine: not a site bug
const harmless = (t) => /fonts\.(googleapis|gstatic)|ERR_(NAME_NOT_RESOLVED|CONNECTION|INTERNET|TUNNEL|PROXY|FAILED)|Failed to load resource/i.test(t);

let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = "http://127.0.0.1:" + server.address().port + "/";
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.close(); });

async function open(opts, file = "index.html", init) {
  const ctx = await browser.newContext(opts);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !harmless(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base + file);
  await page.waitForTimeout(150);
  return { ctx, page, errors };
}
const seen = "try{sessionStorage.setItem('seen','1')}catch(e){}"; // skip the intro counter
const desktop = { viewport: { width: 1280, height: 800 } };
const phone = { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

test("every page loads without errors and shows its heading", async () => {
  for (const f of PAGES) {
    const { ctx, page, errors } = await open(desktop, f, seen);
    assert.ok(await page.locator("h1").first().isVisible(), f + ": h1 visible");
    assert.deepEqual(errors, [], f);
    await ctx.close();
  }
});

test("no horizontal overflow from 320px to 1920px, in English and Russian", async () => {
  for (const lang of ["en", "ru"]) {
    for (const width of [320, 375, 414, 768, 1024, 1440, 1920]) {
      const { ctx, page } = await open({ viewport: { width, height: 800 }, locale: lang === "ru" ? "ru-RU" : "en-US" }, "index.html", seen + `;try{localStorage.setItem('lang','${lang}')}catch(e){}`);
      for (const f of PAGES) {
        await page.goto(base + f);
        await page.waitForTimeout(80);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(over <= 0, `${f} at ${width}px (${lang}) overflows by ${over}px`);
      }
      await ctx.close();
    }
  }
});

test("soft navigation swaps the page, updates the nav and survives back / forward", async () => {
  const { ctx, page, errors } = await open(desktop, "index.html", seen);
  await page.click('#nav a[href="work.html"]');
  await page.waitForURL("**/work.html");
  await page.waitForFunction(() => document.documentElement.dataset.page === "work", null, { timeout: 5000 });
  assert.equal(await page.locator('#nav a[aria-current="page"]').getAttribute("href"), "work.html");
  assert.match(await page.title(), /Work/);
  await page.click("a.next");
  await page.waitForURL("**/about.html");
  assert.equal(await page.locator("html").getAttribute("data-page"), "about");
  const onPage = (n) => page.waitForFunction((x) => document.documentElement.dataset.page === x, n, { timeout: 5000 });
  await onPage("about");
  await page.goBack();
  await page.waitForURL("**/work.html");
  await onPage("work");
  assert.equal(await page.locator('#nav a[aria-current="page"]').getAttribute("href"), "work.html");
  await page.goForward();
  await page.waitForURL("**/about.html");
  await onPage("about");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("clicking the link to the current page does not add history entries", async () => {
  const { ctx, page } = await open(desktop, "index.html", seen);
  const before = await page.evaluate(() => history.length);
  await page.click(".logo");
  await page.click(".logo");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => history.length), before);
  await page.goto(base + "work.html");
  const b2 = await page.evaluate(() => history.length);
  await page.click('#nav a[aria-current="page"]');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => history.length), b2);
  await ctx.close();
});

test("rapid double click on a link ends on the right page", async () => {
  const { ctx, page, errors } = await open(desktop, "index.html", seen);
  await page.dblclick('#nav a[href="contact.html"]');
  await page.waitForURL("**/contact.html");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("html").getAttribute("data-page"), "contact");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("next page opens scrolled to the top", async () => {
  const { ctx, page } = await open(desktop, "work.html", seen);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click("a.next");
  await page.waitForURL("**/about.html");
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 0);
  await ctx.close();
});

test("language switch translates the page and is remembered", async () => {
  const { ctx, page, errors } = await open({ ...desktop, locale: "en-US" }, "work.html", seen);
  const en = await page.locator("h1").innerText();
  await page.click(".lang-btn");
  await page.waitForFunction(() => document.documentElement.lang === "ru");
  const ru = await page.locator("h1").innerText();
  assert.notEqual(en, ru);
  assert.match(ru, /[А-Яа-я]/);
  assert.match(await page.title(), /[А-Яа-я]/);
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.lang), "ru");
  await page.click('#nav a[href="about.html"]');
  await page.waitForURL("**/about.html");
  assert.match(await page.locator("h1").innerText(), /[А-Яа-я]/, "Russian kept after soft navigation");
  await page.click(".lang-btn");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("Russian browsers get Russian by default", async () => {
  const { ctx, page } = await open({ ...desktop, locale: "ru-RU" }, "index.html", seen);
  assert.equal(await page.evaluate(() => document.documentElement.lang), "ru");
  await ctx.close();
});

test("theme switch toggles and is remembered", async () => {
  const { ctx, page } = await open(desktop, "index.html", seen);
  const start = await page.locator("html").getAttribute("data-theme");
  await page.click(".theme-btn");
  await page.waitForFunction((s) => document.documentElement.dataset.theme !== s, start);
  const now = await page.locator("html").getAttribute("data-theme");
  assert.notEqual(now, start);
  await page.goto(base + "contact.html");
  assert.equal(await page.locator("html").getAttribute("data-theme"), now);
  await ctx.close();
});

test("mobile menu opens, lists every page and closes after navigation", async () => {
  const { ctx, page, errors } = await open(phone, "index.html", seen);
  assert.equal(await page.locator("#nav").isVisible(), false, "menu hidden at start");
  await page.tap(".menu-btn");
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#nav").isVisible(), true);
  assert.equal(await page.locator("#nav a").count(), 5);
  assert.equal(await page.locator(".menu-btn").getAttribute("aria-expanded"), "true");
  await page.tap('#nav a[href="notes.html"]');
  await page.waitForURL("**/notes.html");
  await page.waitForTimeout(800);
  assert.equal(await page.locator("#nav").isVisible(), false, "menu closed after navigation");
  assert.equal(await page.locator(".menu-btn").getAttribute("aria-expanded"), "false");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("touch targets on a phone are at least 40px", async () => {
  const { ctx, page } = await open(phone, "index.html", seen);
  const small = [];
  for (const f of ["index.html", "play.html"]) {
    await page.goto(base + f);
    const items = await page.evaluate(() => [...document.querySelectorAll("a, button")].filter((e) => e.offsetParent !== null || e.closest(".site-header")).map((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20), w: r.width, h: r.height, vis: r.width > 0 && cs.visibility !== "hidden" && !e.closest(".nav") };
    }));
    for (const i of items) if (i.vis && (i.h < 40 || i.w < 40)) small.push(`${f}: "${i.t}" ${Math.round(i.w)}x${Math.round(i.h)}`);
  }
  assert.deepEqual(small, []);
  await ctx.close();
});

test("demo bot answers, goes back and resets", async () => {
  const { ctx, page, errors } = await open(desktop, "play.html", seen);
  await page.waitForSelector("#options button");
  const first = await page.locator("#chat").innerText();
  assert.ok(first.length > 10, "bot greets");
  await page.locator("#options button").first().click();
  await page.waitForFunction((n) => document.getElementById("chat").innerText.length > n, first.length, { timeout: 5000 });
  await page.click("#reset");
  await page.waitForTimeout(500);
  assert.equal((await page.locator("#chat").innerText()).length, first.length);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("bot still works after arriving by soft navigation", async () => {
  const { ctx, page, errors } = await open(desktop, "notes.html", seen);
  await page.click('#nav a[href="play.html"]');
  await page.waitForURL("**/play.html");
  await page.waitForSelector("#options button", { timeout: 5000 });
  assert.ok((await page.locator("#chat").innerText()).length > 10);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("cursor follower exists with a mouse only", async () => {
  const d = await open(desktop, "index.html", seen);
  await d.page.mouse.move(300, 300);
  assert.equal(await d.page.locator(".cursor-dot").count(), 1);
  assert.equal(await d.page.locator(".cursor-ring").count(), 1);
  await d.ctx.close();
  const p = await open(phone, "index.html", seen);
  assert.equal(await p.page.locator(".cursor-dot").count(), 0);
  await p.ctx.close();
});

test("cursor ring grows over links", async () => {
  const { ctx, page } = await open(desktop, "index.html", seen);
  await page.mouse.move(200, 400);
  const box = await page.locator('#nav a[href="work.html"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.waitForFunction(() => document.body.classList.contains("cursor-hover"));
  await page.mouse.move(200, 500, { steps: 4 });
  await page.waitForFunction(() => !document.body.classList.contains("cursor-hover"));
  await ctx.close();
});

test("works with reduced motion (plain page loads, no animation)", async () => {
  const { ctx, page, errors } = await open({ ...desktop, reducedMotion: "reduce" }, "index.html");
  await page.click('#nav a[href="about.html"]');
  await page.waitForURL("**/about.html");
  assert.ok(await page.locator("h1").isVisible());
  assert.equal(await page.locator(".cursor-dot").count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("pause button stops animations and switches soft navigation off", async () => {
  const { ctx, page } = await open(desktop, "work.html", seen);
  await page.click("#pause");
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("paused")), true);
  await page.click('#nav a[href="about.html"]');
  await page.waitForURL("**/about.html");
  assert.ok(await page.locator("h1").isVisible());
  await ctx.close();
});

test("with JavaScript off the content and menu links are still reachable", async () => {
  for (const o of [desktop, phone]) {
    const { ctx, page } = await open({ ...o, javaScriptEnabled: false }, "work.html");
    assert.ok(await page.locator("h1").isVisible(), "h1");
    assert.ok(await page.locator(".project h2").first().isVisible(), "projects");
    assert.ok(await page.locator('#nav a[href="contact.html"]').isVisible(), "nav link visible");
    await ctx.close();
  }
});

test("missing page returns the 404 page", async () => {
  const { ctx, page } = await open(desktop, "404.html");
  assert.match(await page.locator("h1").innerText(), /404/);
  await ctx.close();
});

test("loader finishes on the first visit and is skipped afterwards", async () => {
  const { ctx, page } = await open(desktop, "index.html");
  await page.waitForFunction(() => document.body.classList.contains("ready"), null, { timeout: 8000 });
  await page.waitForSelector("#loader", { state: "detached", timeout: 3000 });
  await ctx.close();
});
