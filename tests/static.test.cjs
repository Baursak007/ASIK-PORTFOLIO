// Static checks: no browser needed. Run with: node --test tests/static.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const PAGES = ["index", "work", "about", "notes", "play", "contact"];
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const html = Object.fromEntries(PAGES.map((p) => [p, read(p + ".html")]));

// text a visitor can read (scripts, styles and tags removed)
function visibleText(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean);
}
function loadI18n() {
  const src = read("i18n.js");
  const ru = src.match(/var RU = (\{[\s\S]*?\n\});/);
  const dyn = src.match(/var DYN = (\{[\s\S]*?\n\});/);
  assert.ok(ru, "RU dictionary not found in i18n.js");
  return { RU: vm.runInNewContext("(" + ru[1] + ")"), DYN: dyn ? vm.runInNewContext("(" + dyn[1] + ")") : {} };
}

test("every page has the basics", () => {
  for (const p of PAGES) {
    const s = html[p];
    assert.match(s, /^<!doctype html>/i, p + ": doctype");
    assert.match(s, /<html lang="en"/, p + ": lang attribute");
    assert.match(s, /<meta name="viewport"/, p + ": viewport");
    assert.match(s, /<title>[^<]+<\/title>/, p + ": title");
    assert.match(s, /<meta name="description" content="[^"]+"/, p + ": description");
    assert.match(s, /rel="icon"/, p + ": favicon link");
    assert.equal((s.match(/<h1[\s>]/g) || []).length, 1, p + ": exactly one h1");
    assert.match(s, /<script src="i18n\.js">/, p + ": i18n.js");
    assert.match(s, /<script src="script\.js">/, p + ": script.js");
  }
});

test("ids are unique on every page", () => {
  for (const p of PAGES) {
    const ids = [...html[p].matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], p + ": duplicate ids");
  }
});

test("local links and assets exist", () => {
  const files = new Set(fs.readdirSync(ROOT));
  for (const p of PAGES) {
    for (const m of html[p].matchAll(/(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:|data:)/.test(u)) continue;
      assert.ok(files.has(u), `${p}.html links to missing file ${u}`);
    }
    for (const m of html[p].matchAll(/href="#([^"]+)"/g)) {
      assert.match(html[p], new RegExp(`id="${m[1]}"`), `${p}.html: #${m[1]} has no target`);
    }
  }
});

test("external links open safely", () => {
  for (const p of PAGES) {
    for (const m of html[p].matchAll(/<a\b[^>]*>/g)) {
      const tag = m[0];
      if (/target="_blank"/.test(tag)) assert.match(tag, /rel="[^"]*noopener/, p + ": missing rel=noopener in " + tag);
      const href = (tag.match(/href="([^"]+)"/) || [])[1] || "";
      if (/^https?:\/\//.test(href)) assert.match(href, /^https:\/\//, p + ": non-https link " + href);
    }
  }
});

test("main navigation is the same on every page and marks the current page", () => {
  for (const p of PAGES) {
    const nav = html[p].match(/<nav id="nav"[\s\S]*?<\/nav>/)[0];
    for (const f of ["work", "about", "notes", "play", "contact"]) assert.ok(nav.includes(`href="${f}.html"`), `${p}: nav lacks ${f}`);
    const current = [...nav.matchAll(/<a href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
    assert.deepEqual(current, p === "index" ? [] : [p + ".html"], p + ": aria-current");
  }
});

test("Next chain visits every page once and ends back at the top", () => {
  const order = ["index", "work", "about", "notes", "play", "contact"];
  order.slice(0, -1).forEach((p, i) => {
    const m = html[p].match(/<a class="next[^"]*" href="([^"]+)"[\s\S]*?<small>(\d\d) \/ (\d\d)/);
    assert.ok(m, p + ": has a Next link");
    assert.equal(m[1], order[i + 1] + ".html", p + ": next target");
    assert.equal(Number(m[2]), i + 1, p + ": counter");
    assert.equal(Number(m[3]), 6, p + ": total");
  });
  assert.match(html.contact, /href="#top"/, "contact: back to top link");
  assert.match(html.contact, /<main id="top">/, "contact: top target");
});

test("no sentence-ending periods in visible text (English)", () => {
  for (const p of PAGES) {
    const bad = visibleText(html[p]).filter((l) => /[.](\s|$)/.test(l.replace(/\be\.g\./g, "")) && !/@/.test(l));
    assert.deepEqual(bad, [], p + ": periods in text");
    const meta = [...html[p].matchAll(/content="([^"]+)"/g)].map((m) => m[1]).filter((c) => /\.\s*$/.test(c));
    assert.deepEqual(meta, [], p + ": periods in meta");
  }
});

test("no sentence-ending periods in Russian / dynamic strings", () => {
  const { RU, DYN } = loadI18n();
  const all = { ...RU, ...DYN };
  const bad = Object.entries(all).filter(([, v]) => typeof v === "string" && /[.](\s|$)/.test(v.replace(/\.\.\./g, ""))).map(([k, v]) => k + ": " + v);
  assert.deepEqual(bad, []);
});

test("play.js bot messages have no sentence-ending periods", () => {
  const strings = [...read("play.js").matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
  const bad = strings.filter((s) => /[A-Za-zА-Яа-я)][.](\s|$)/.test(s) && !/\.(js|html|css)\b/.test(s) && !/^https?:/.test(s));
  assert.deepEqual(bad, []);
});

test("every data-i18n key has a Russian translation", () => {
  const { RU } = loadI18n();
  const missing = new Set();
  for (const p of PAGES) {
    for (const m of html[p].matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) if (!(m[1] in RU)) missing.add(p + ": " + m[1]);
  }
  assert.deepEqual([...missing], []);
});

test("every Russian key is used somewhere (no dead translations)", () => {
  const { RU } = loadI18n();
  const used = new Set();
  for (const p of PAGES) for (const m of html[p].matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) used.add(m[1]);
  const src = read("i18n.js") + read("script.js") + read("play.js");
  // title.<page> and desc.<page> are looked up by page name in i18n.js
  const dead = Object.keys(RU).filter((k) => !used.has(k) && !/^(title|desc)\.(\w+)$/.test(k) && !src.replace(/var RU[\s\S]*?\n\};/, "").includes(k));
  assert.deepEqual(dead, []);
  for (const p of PAGES) for (const pre of ["title.", "desc."]) assert.ok((pre + p) in RU, "missing " + pre + p);
});

test("Russian text really is Russian (no untranslated copies of English)", () => {
  const { RU } = loadI18n();
  const same = Object.entries(RU).filter(([k, v]) => typeof v === "string" && /^[\x00-\x7F]+$/.test(v) && v.length > 25).map(([k]) => k);
  assert.deepEqual(same, []);
});

test("no placeholders, secrets or tokens in the repository", () => {
  const files = fs.readdirSync(ROOT).filter((f) => /\.(html|css|js|json|md|txt|xml|svg|cjs)$/.test(f)).concat(fs.readdirSync(__dirname).map((f) => "tests/" + f));
  const patterns = [/\bYOUR_[A-Z_]+\b/, /\d{8,10}:[A-Za-z0-9_-]{35}/, /ghp_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /sk-[A-Za-z0-9]{32,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,}/i];
  for (const f of files) {
    if (f === "tests/static.test.cjs") continue;
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const re of patterns) assert.ok(!re.test(s), `${f} matches secret pattern ${re}`);
  }
});

test("JavaScript files parse", () => {
  for (const f of ["script.js", "i18n.js", "play.js"]) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});

test("CSS braces are balanced", () => {
  const css = read("style.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test("contact details match the real accounts", () => {
  const c = html.contact;
  assert.ok(c.includes("https://t.me/Auramonster"));
  assert.ok(c.includes("https://github.com/Baursak007"));
  assert.ok(c.includes("https://wa.me/77479473841"));
  assert.ok(c.includes("mailto:akmaral.koptleuovaa@gmail.com"));
});

test("colors keep readable contrast in both themes", () => {
  const css = read("style.css");
  const block = (sel) => css.match(new RegExp(sel + "\\s*\\{([\\s\\S]*?)\\}"))[1];
  const get = (b, v) => (b.match(new RegExp("--" + v + ":\\s*(#[0-9a-fA-F]{6})")) || [])[1];
  const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const sel of [':root', ':root\\[data-theme="light"\\]']) {
    const b = block(sel);
    const bg = get(b, "bg") || get(block(":root"), "bg");
    for (const v of ["fg", "muted"]) {
      const c = get(b, v);
      if (c && bg) assert.ok(ratio(c, bg) >= 4.5, `${sel} --${v} on bg is ${ratio(c, bg).toFixed(2)}`);
    }
    const card = get(b, "card"), muted = get(b, "muted");
    if (card && muted) assert.ok(ratio(muted, card) >= 4.5, `${sel} --muted on card is ${ratio(muted, card).toFixed(2)}`);
  }
});

test("sitemap lists every page", () => {
  const s = read("sitemap.xml");
  for (const p of PAGES.filter((x) => x !== "index")) assert.ok(s.includes(p + ".html"), p);
  assert.match(read("robots.txt"), /Sitemap:/);
});
