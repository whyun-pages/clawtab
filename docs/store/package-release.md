# Release Packaging

Build the extension:

```powershell
pnpm package:chrome
```

This command rebuilds the extension and creates `releases/clawtab-v<manifest version>.zip` from the contents of `dist/`, not the parent `dist` folder itself.

Before uploading, inspect the ZIP and confirm these files are present:

```text
manifest.json
background.js
content.js
popup.html
popup.js
styles.css
icons/icon16.png
icons/icon32.png
icons/icon48.png
icons/icon128.png
```

If you do not want to publish source maps, set `sourcemap: false` for production builds or remove source maps from the ZIP before upload.
