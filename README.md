# HAR Extractor

Extract and download response content from HAR (HTTP Archive) files. Works as a browser web app or a reusable JavaScript module (browser & Node.js).

**[Live Usage](https://bhuban94.github.io/HAR-Extractor/)**

**[Latest Release](https://github.com/Bhuban94/HAR-Extractor/releases/latest)**

## Features

- Upload one or multiple HAR files via drag-and-drop
- Mirrors original URL structure in output directories
- Automatic MIME-based file extension detection
- Windows-safe filename sanitization
- Optional query-string hash suffixes for request differentiation
- Query parameter manifest generation for replay/triage
- Processing log tracking every entry's outcome
- ZIP download of all extracted content
- Real-time progress tracking

> **Project Information:** For details about the Web App UI, architecture, and project structure, please see [PROJECT_INFO.md](PROJECT_INFO.md).

## Core Module Usage

`core/har-extract-core.js` works standalone in any JavaScript environment.

### Install (NPM)

```bash
npm install @bhuban94/har-extract-core
```

### Browser

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="core/har-extract-core.js"></script>
<script>
  const harData = JSON.parse(harJsonString);
  const { files, stats, queryMap, queryManifest } = await HarExtractCore.extractFilesFromHar(harData, {
    includeQuerySuffix: true,
    generateQueryManifest: true
  });
  // files: Map<string, Uint8Array>
  console.log(`Extracted: ${stats.extracted}, Skipped: ${stats.skipped}`);
</script>
```

### Node.js

```javascript
const HarExtractCore = require('har-extract-core');
const fs = require('fs');

const harData = JSON.parse(fs.readFileSync('trace.har', 'utf8'));
const { files, stats } = await HarExtractCore.extractFilesFromHar(harData, {
  includeQuerySuffix: true,
  harName: 'export'
});
console.log(`Extracted ${stats.extracted} files`);
```

### Node.js (ESM)

```javascript
import HarExtractCore from 'har-extract-core';

const { files, stats } = await HarExtractCore.extractFilesFromHar(harData, {
  includeQuerySuffix: true,
});
```

### TypeScript

Type declarations are included via `core/har-extract-core.d.ts`, so editors provide IntelliSense and type checking without extra setup.

See `examples/examples.js` for 11 detailed usage examples (filtering, multi-file, progress tracking, Node.js, query manifest, etc.).

---

## API Reference

### `extractFilesFromHar(harData, options)` — Main extraction function

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeQuerySuffix` | boolean | false | Hash query params into filenames |
| `generateQueryManifest` | boolean | false | Generate structured query metadata |
| `onProgress` | Function | null | Progress callback `({ current, total })` |
| `harName` | string | 'export' | Root folder name |

**Returns:** `Promise<{ files, stats, queryMap, queryManifest, processingLog }>`

| Field | Type | Description |
|-------|------|-------------|
| `files` | `Map<string, Uint8Array>` | Extracted file contents keyed by path |
| `stats` | `{ extracted, skipped, failed, harName }` | Processing counts |
| `queryMap` | `Map<string, string>` | File path → original query string |
| `queryManifest` | Object \| null | Structured query parameter metadata |
| `processingLog` | Array | Per-entry status log (extracted/skipped/failed with reasons) |

### `extractFilesFromHarAsZip(harData, options)`

Convenience wrapper — extracts and creates ZIP in one call. Same options as above.

**Returns:** `Promise<{ zip, stats, queryMap, queryManifest, fileCount }>`

### `buildRelativeOutputPath(url, mimeType, includeQuerySuffix)`

Converts a URL to a filesystem-safe relative path.

```javascript
HarExtractCore.buildRelativeOutputPath('https://example.com/api/data?key=val', 'application/json', true);
// → "https/example.com/api/data__q_a1b2c3d4e5.json"
```

### `createZipArchive(files, harName, queryManifest, processingLog)`

Creates a JSZip object from a files Map. Includes `_query-manifest.json` and `_processing-log.json` when provided.

### `normalizeQueryString(queryString)`

Sorts query parameters alphabetically for consistent hashing.

```javascript
HarExtractCore.normalizeQueryString('?sort=name&id=123');
// → "?id=123&sort=name"
```

### `hashString(str)`

Synchronous DJB2-variant hash. Returns a hex string.

### `sanitizeSegment(value)`

Makes a URL segment filesystem-safe (decodes, removes illegal chars, handles Windows reserved names).

### `extensionFromMime(mimeType)`

Returns file extension for a MIME type (e.g., `'application/json'` → `'.json'`). Returns `''` if unknown. Customizable via the `MIME_EXTENSIONS` object.

---

## Output Structure

Extracted content mirrors the original URL hierarchy:

```
export/
├── https/
│   └── example.com/
│       ├── api/
│       │   ├── data.json
│       │   └── user__q_a1b2c3.json    ← query hash suffix
│       └── index.html
├── _query-manifest.json                ← when manifest enabled
└── _processing-log.json                ← always included in ZIP
```

### URL → File Path Examples

| URL | Output Path |
|-----|-------------|
| `https://example.com/` | `https/example.com/index.html` |
| `https://example.com/api/users` | `https/example.com/api/users.json` |
| `https://example.com/app?v=1.2` | `https/example.com/app__q_a1b2c3d4e5.json` |

---

## Contributing

Development workflow, smoke-test commands, and pull request guidance are in `CONTRIBUTION.md`.

## Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 55+ | Supported |
| Firefox | 52+ | Supported |
| Safari | 11+ | Supported |
| Edge | 79+ | Supported |
| Node.js | 12+ | Supported |

## Limitations

- Max file size depends on browser memory (typically several hundred MB; recommended under 100 MB for best experience)
- Some special characters in URLs may still cause issues despite sanitization

## Related

- [HAR 1.2 Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [JSZip](https://stuk.github.io/jszip/)

## License
Licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.
