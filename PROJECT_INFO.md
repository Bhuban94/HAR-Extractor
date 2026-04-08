# HAR Extractor - Project Information

This document contains information about the web application, architecture, and project structure.

## Quick Start (Web App)

1. Open `index.html` in any modern browser (no server needed)
2. Drag-and-drop `.har` files or click to select
3. Configure options:
   - **Include query-string hash** — differentiates requests with different query parameters
   - **Generate query parameter manifest** — creates a structured manifest for replay/triage
4. Click **Process & Download** — browser downloads a ZIP

> **Privacy note:** HAR files may contain sensitive data (cookies, auth tokens, personal information). If your HAR files contain sensitive information, download the [latest release ZIP](https://github.com/Bhuban94/HAR-Extractor/releases/latest) and use it locally instead of the hosted version.

## Project Structure

```
├── index.html                # Web UI
├── har-extractor.js          # Web app controller
├── styles.css                # UI styles
├── scripts/
│   └── run-packed-test.js    # Smoke test runner (pack/install/test)
├── core/
│   └── har-extract-core.js   # Core module (standalone, reusable)
│   └── har-extract-core.mjs  # ESM wrapper export
│   └── har-extract-core.d.ts # TypeScript declarations
├── examples/
│   └── examples.js           # 11 usage examples
├── tests/
│   └── smokeTest.js          # Smoke assertions copied into isolated run workspace
└── README.md                 # This file
```

**Dependency:** [JSZip](https://stuk.github.io/jszip/) (included via CDN in web app)

## Architecture

```
index.html          → UI layout
har-extractor.js    → App controller (file handling, UI events)
  └── calls ──────→ core/har-extract-core.js (standalone module)
                      └── uses ──→ JSZip (ZIP creation)
```

Each layer is independent — use the core module without the web app, or replace the UI entirely.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"JSZip not loaded"** | Ensure JSZip script loads before `har-extractor.js`. If CDN is blocked, download `jszip.min.js` locally. |
| **"HarExtractCore not loaded"** | Load `core/har-extract-core.js` before `har-extractor.js` |
| **"No content to export"** | HAR file may lack response content — verify `response.content.text` is populated |
| **Memory issues** | Process large HAR files in batches, or use Node.js for server-side processing |
| **Blank page / CORS error** | Check browser console (F12); try a local web server (e.g., VS Code Live Server) |

Script load order must be: JSZip → `core/har-extract-core.js` → `har-extractor.js`
