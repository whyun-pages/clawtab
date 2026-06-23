# Chrome Web Store Publish Checklist

## Required before upload

- [ ] Build production extension and create the store ZIP with `pnpm package:chrome`.
- [ ] Confirm `dist/manifest.json` contains correct `icons` and `action.default_icon`.
- [ ] Confirm `dist/icons/icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png` exist.
- [ ] Decide whether source maps should be included in the release package.
- [ ] Remove `web_accessible_resources` access to `*.map` if source maps should not be public.

## Store listing

- [ ] Name: `ClawTab`
- [ ] Short description from `docs/store/listing.md`
- [ ] Detailed description from `docs/store/listing.md`
- [ ] Category: `Productivity`
- [ ] Language: `Chinese (Simplified)`
- [ ] Upload at least 1 screenshot.
- [ ] Add support email or support URL.
- [ ] Publish privacy policy page and paste its public URL.

## Privacy practices

- [ ] Disclose website content processing.
- [ ] Disclose user input processing.
- [ ] Disclose local chat history storage.
- [ ] Disclose local API key / model configuration storage.
- [ ] State that data is sent to the user-configured model endpoint.
- [ ] Confirm whether you collect any data yourself. If not, state that the extension has no developer-operated backend.

## Review notes

- [ ] Provide temporary test Base URL, API Key, and Model, or a clear test procedure.
- [ ] Include permission justifications from `docs/store/review-notes.md`.
- [ ] Verify the extension works after fresh install with no existing storage.

## Recommended polish

- [ ] Replace placeholder contact text in privacy policy.
- [ ] Capture screenshots from a clean Chrome profile.
- [ ] Confirm icon appears clearly at 16x16 and 32x32.
- [ ] Consider narrowing `<all_urls>` if the product can work with a smaller host permission scope.
