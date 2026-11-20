# Portfolio — Asik

Static portfolio site (HTML, CSS, JS). No build step, no dependencies.

## Files

- `index.html`, `work.html`, `about.html`, `notes.html`, `play.html`, `contact.html`
- `style.css`, `script.js`, `i18n.js`, `play.js` (the demo bot on the Play page)
- `favicon.svg`, `404.html`, `robots.txt`, `sitemap.xml`
- `tests/` — automated checks (see Tests below)

## Before publishing

Replace the placeholder text in `work.html` (project 03, the SMM case) and the draft posts in `notes.html` with your own.

## Publish on GitHub Pages

1. Open the repository on GitHub → Settings → Pages.
2. Source: "Deploy from a branch" → pick the branch you want to publish and `/ (root)` → Save.
3. Wait a minute. The site appears at `https://baursak007.github.io/ASIK-PORTFOLIO/`.

## Languages

The site has English and Russian. English text is written in the HTML; Russian lives in `i18n.js` (the `RU` dictionary, matched by each element's `data-i18n` key). The language button is in the header and the choice is remembered in the browser.

## Customise

- Colors and fonts: variables at the top of `style.css` (`--accent` is the highlight color).
- Light/dark theme: toggle in the header, remembered in the browser.

## Tests

The site itself needs no tools, only the tests do.

```
npm run test:static    # no dependencies: links, translations, no periods in texts, secrets scan, contrast
npm run test:browser   # needs the playwright package and Chromium: navigation, language, theme, mobile menu, bot
npm test               # both
```

Add a new page: put it in `PAGES` at the top of both test files, add its `title.<page>` / `desc.<page>` Russian strings in `i18n.js`, and add it to `sitemap.xml`.

## Security notes

- Never put bot tokens, API keys or passwords in this repository, it is public. Keep them in environment variables or GitHub Secrets.
- Turn on two-factor authentication for the GitHub account: it is the one way to take over this site.
- Settings → Pages → keep "Enforce HTTPS" on.
