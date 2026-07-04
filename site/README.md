# ClawTab site

Static landing page and privacy policy for the ClawTab Chrome extension.

## Layout

- `index.html` — 中文首页（默认语言）
- `privacy-policy.html` — 中文隐私政策
- `en/index.html` — English landing page
- `en/privacy-policy.html` — English privacy policy
- `assets/` — shared CSS and images

Pure static HTML/CSS. No build step, no dependencies, no external network requests.

## Local preview

```bash
cd site
python -m http.server 8080
```

Then open http://localhost:8080.

## Deploy to GitHub Pages

1. In the repository settings enable **Pages** with source **Deploy from a branch**.
2. Pick the `main` branch and set the folder to `/site`.
3. Visit the generated URL (e.g. `https://whyun-pages.github.io/clawtab/`).

The privacy policy URL to paste into the Chrome Web Store form is:

```
https://<your-pages-domain>/privacy-policy.html
```

## Editing content

The source of truth for store listing copy is `../docs/store/listing.md`; the source of truth for the
privacy policy is `../docs/store/privacy-policy.md`. When either changes, update the corresponding
HTML page in this folder.
