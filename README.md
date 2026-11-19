# Portfolio — Asik

Static portfolio site (HTML, CSS, JS). No build step, no dependencies.

## Files

- `index.html`, `work.html`, `about.html`, `notes.html`, `play.html`, `contact.html`
- `style.css`, `script.js`, `i18n.js`, `play.js` (the demo bot on the Play page)

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
