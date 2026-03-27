/**
 * HAR Extract Core Module - Usage Examples
 * 
 * Demonstrates various ways to use HarExtractCore in different environments
 */

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ============================================================================
// EXAMPLE 1: Basic Web Browser Usage (with HTML file upload)
// ============================================================================

async function example1_BasicBrowserUsage() {
  const fileInput = document.getElementById('har-file');
  const file = fileInput.files[0];

  // Read the file
  const text = await file.text();
  const harData = JSON.parse(text);

  // Extract content
  const { files, stats, queryMap } = await HarExtractCore.extractFilesFromHar(harData, {
    includeQuerySuffix: false
  });

  console.log(`Extracted ${stats.extracted} files, skipped ${stats.skipped}`);

  // Use the files (e.g., iterate over them)
  for (const [filepath, content] of files) {
    console.log(`${filepath}: ${content.length} bytes`);
  }

  // Reverse lookup: check original query strings
  for (const [filepath, query] of queryMap) {
    console.log(`${filepath} had query: ${query}`);
  }
}

// ============================================================================
// EXAMPLE 2: Generate ZIP Download
// ============================================================================

async function example2_GenerateZipDownload() {
  const harData = await fetch('trace.har').then(r => r.json());

  // Use convenience function
  const { zip, stats, queryMap, queryManifest, fileCount } = await HarExtractCore.extractFilesFromHarAsZip(harData, {
    includeQuerySuffix: true,
    generateQueryManifest: true
  });

  console.log(`Created ZIP with ${fileCount} files`);

  // Generate blob and download
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'har-extract.zip');
}

// ============================================================================
// EXAMPLE 3: Process Multiple HAR Files Into Single ZIP
// ============================================================================

async function example3_MultipleFilesInZip() {
  const harFiles = [
    'trace1.har',
    'trace2.har',
    'trace3.har'
  ];

  const masterZip = new JSZip();

  for (const harFile of harFiles) {
    const harData = await fetch(harFile).then(r => r.json());
    const { files, stats } = await HarExtractCore.extractFilesFromHar(harData);

    // Create folder for each HAR file
    const harName = harFile.replace('.har', '');
    const folder = masterZip.folder(harName);

    // Add all files from this HAR to its folder
    for (const [filepath, content] of files) {
      folder.file(filepath, content);
    }

    console.log(`${harFile}: extracted ${stats.extracted}`);
  }

  // Download combined ZIP
  const blob = await masterZip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'combined-har-extract.zip');
}

// ============================================================================
// EXAMPLE 4: Filter Specific File Types
// ============================================================================

async function example4_FilterByMimeType() {
  const harData = await fetch('trace.har').then(r => r.json());
  const { files, stats } = await HarExtractCore.extractFilesFromHar(harData);

  // Extract only JavaScript files
  const jsFiles = new Map();
  for (const [filepath, content] of files) {
    if (filepath.endsWith('.js')) {
      jsFiles.set(filepath, content);
    }
  }

  console.log(`Found ${jsFiles.size} JavaScript files`);

  // Or extract by URL pattern
  const apiFiles = new Map();
  for (const [filepath, content] of files) {
    if (filepath.includes('/api/')) {
      apiFiles.set(filepath, content);
    }
  }

  console.log(`Found ${apiFiles.size} API response files`);
}

// ============================================================================
// EXAMPLE 5: Process with Progress Tracking
// ============================================================================

async function example5_ProgressTracking() {
  const harData = await fetch('large-trace.har').then(r => r.json());

  const { files, stats, queryMap } = await HarExtractCore.extractFilesFromHar(harData, {
    includeQuerySuffix: true,
    harName: 'my-trace',
    onProgress: (progress) => {
      const percent = Math.round((progress.current / progress.total) * 100);
      console.log(`Processing: ${percent}% (${progress.current}/${progress.total})`);
      
      // Update UI progress bar
      document.getElementById('progress').value = percent;
    }
  });

  console.log('Done!', stats);
}

// ============================================================================
// EXAMPLE 6: Custom Path Transformation
// ============================================================================

async function example6_CustomPathTransformation() {
  const harData = await fetch('trace.har').then(r => r.json());
  const { files, stats } = await HarExtractCore.extractFilesFromHar(harData);

  // Transform paths - e.g., flatten to single directory with hashed names
  const flatFiles = new Map();
  
  for (const [filepath, content] of files) {
    // Create a hash of the full path
    const hash = await HarExtractCore.hashString(filepath);
    const filename = `${hash.substring(0, 8)}.data`;
    flatFiles.set(filename, content);
  }

  console.log(`Transformed ${flatFiles.size} files to flat structure`);
}

// ============================================================================
// EXAMPLE 7: Extract and Analyze HAR Content
// ============================================================================

async function example7_AnalyzeHarContent() {
  const harData = await fetch('trace.har').then(r => r.json());

  const analysis = {
    totalRequests: harData.log.entries.length,
    byMimeType: {},
    byHost: {},
    totalSize: 0,
    failedRequests: 0
  };

  for (const entry of harData.log.entries) {
    const request = entry.request || {};
    const response = entry.response || {};
    const content = response.content || {};

    // Count by MIME type
    const mime = content.mimeType || 'unknown';
    analysis.byMimeType[mime] = (analysis.byMimeType[mime] || 0) + 1;

    // Count by host
    const url = new URL(request.url);
    const host = url.hostname;
    analysis.byHost[host] = (analysis.byHost[host] || 0) + 1;

    // Track size
    analysis.totalSize += content.size || 0;

    // Count failures
    if (response.status >= 400) {
      analysis.failedRequests++;
    }
  }

  console.log('HAR Analysis:', analysis);
  return analysis;
}

// ============================================================================
// EXAMPLE 8: Node.js Usage (if core module is used in Node environment)
// ============================================================================

// This example assumes Node.js environment with CommonJS
/*
const HarExtractCore = require('../core/har-extract-core.js');
const fs = require('fs');
const path = require('path');

async function example8_NodeJsExport() {
  // Read HAR file
  const harData = JSON.parse(fs.readFileSync('trace.har', 'utf8'));

  // Extract content
  const { files, stats, queryMap } = await HarExtractCore.extractFilesFromHar(harData, {
    includeQuerySuffix: true
  });

  // Write to disk
  const outputDir = './exported';
  
  for (const [filepath, content] of files) {
    const fullPath = path.join(outputDir, filepath);
    
    // Create directories
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    
    // Write file (content is Uint8Array, convert to Buffer)
    fs.writeFileSync(fullPath, Buffer.from(content));
  }

  console.log(`Extracted ${stats.extracted} files to ${outputDir}`);
}

example8_NodeJsExport();
*/

// ============================================================================
// EXAMPLE 9: Extract Specific URL Paths
// ============================================================================

async function example9_ExtractSpecificUrls() {
  const harData = await fetch('trace.har').then(r => r.json());

  // Extract only certain URLs
  const urlPatterns = [
    /\/api\/v1\//,      // API endpoints
    /\.css$/,           // Stylesheets
    /\.json$/           // JSON files
  ];

  const filtered = new Map();

  for (const entry of harData.log.entries) {
    const url = entry.request?.url || '';
    
    if (urlPatterns.some(pattern => pattern.test(url))) {
      const mimeType = entry.response?.content?.mimeType || '';
      const filepath = HarExtractCore.buildRelativeOutputPath(url, mimeType);
      const content = HarExtractCore.decodeContentBytes(entry.response?.content || {});

      if (content) {
        filtered.set(filepath, content);
      }
    }
  }

  console.log(`Filtered to ${filtered.size} matching URLs`);
}

// ============================================================================
// EXAMPLE 10: Compare Two HAR Files
// ============================================================================

async function example10_CompareTwoHarFiles() {
  const har1 = await fetch('trace1.har').then(r => r.json());
  const har2 = await fetch('trace2.har').then(r => r.json());

  const { files: files1 } = await HarExtractCore.extractFilesFromHar(har1);
  const { files: files2 } = await HarExtractCore.extractFilesFromHar(har2);

  console.log(`HAR1 has ${files1.size} files, HAR2 has ${files2.size} files`);

  // Find files only in HAR1
  const onlyInHar1 = new Map();
  for (const [path, content] of files1) {
    if (!files2.has(path)) {
      onlyInHar1.set(path, content);
    }
  }

  // Find files only in HAR2
  const onlyInHar2 = new Map();
  for (const [path, content] of files2) {
    if (!files1.has(path)) {
      onlyInHar2.set(path, content);
    }
  }

  console.log(`Only in HAR1: ${onlyInHar1.size}, Only in HAR2: ${onlyInHar2.size}`);
}

// ============================================================================
// EXAMPLE 11: Query Manifest for Replay/Triage
// ============================================================================

async function example11_QueryManifest() {
  const harData = await fetch('trace.har').then(r => r.json());

  // Extract with query manifest enabled
  const { files, stats, queryMap, queryManifest } = await HarExtractCore.extractFilesFromHar(harData, {
    includeQuerySuffix: true,
    generateQueryManifest: true,
    harName: 'my-trace'
  });

  console.log(`Extracted ${stats.extracted} files`);

  // queryManifest contains structured metadata for all URLs with query params
  if (queryManifest) {
    console.log(`Manifest has ${queryManifest.totalEntries} entries`);

    for (const entry of queryManifest.queryParameters) {
      console.log(`Base URL: ${entry.baseUrl}`);
      console.log(`  Original query: ${entry.originalQuery}`);
      console.log(`  Normalized:     ${entry.normalizedQuery}`);
      console.log(`  Hash:           ${entry.hash}`);
      console.log(`  File:           ${entry.filePath}`);
      console.log(`  MIME:           ${entry.mimeType}`);
    }
  }

  // Normalize query strings for consistent comparison
  const q1 = HarExtractCore.normalizeQueryString('?sort=name&id=123');
  const q2 = HarExtractCore.normalizeQueryString('?id=123&sort=name');
  console.log(q1 === q2); // true — both produce "?id=123&sort=name"
}

// ============================================================================
// Export examples (for use in modules or testing)
// ============================================================================

const Examples = {
  basicBrowserUsage: example1_BasicBrowserUsage,
  generateZipDownload: example2_GenerateZipDownload,
  multipleFilesInZip: example3_MultipleFilesInZip,
  filterByMimeType: example4_FilterByMimeType,
  progressTracking: example5_ProgressTracking,
  customPathTransformation: example6_CustomPathTransformation,
  analyzeHarContent: example7_AnalyzeHarContent,
  extractSpecificUrls: example9_ExtractSpecificUrls,
  compareTwoHarFiles: example10_CompareTwoHarFiles,
  queryManifest: example11_QueryManifest
};

// For Node.js or module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Examples;
}
