/**
 * HAR Extract Core Module - Core module for extracting files from HAR files
 * 
 * This core module provides utilities to parse HAR (HTTP Archive) files and
 * organize response content into a directory structure that mirrors the
 * original URL scheme and paths. Can be used standalone or in web/Node.js environments.
 * 
 * Dependencies:
 *   - jszip: For creating ZIP archives
 * 
 * Usage:
 *   const lib = HarExtractCore;
 *   const files = await lib.extractFilesFromHar(harData, options);
 */

const HarExtractCore = (() => {
  'use strict';

  /**
   * Windows reserved device names that cannot be used as file or directory names
   */
  const WINDOWS_RESERVED_NAMES = new Set([
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  ]);

  /**
   * Common MIME type to file extension mappings
   */
  const MIME_EXTENSIONS = {
    'application/javascript': '.js',
    'text/javascript': '.js',
    'application/json': '.json',
    'image/svg+xml': '.svg',
    'text/html': '.html',
    'text/css': '.css',
    'text/plain': '.txt',
    'application/xml': '.xml',
    'text/xml': '.xml',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/octet-stream': '.bin',
  };

  /**
   * Sanitize a URL segment or filename to be filesystem-safe.
   * 
   * Removes URL encoding, strips whitespace, replaces illegal characters
   * with underscores, and prevents Windows reserved names.
   * 
   * @param {string} value - String to sanitize (e.g., URL path component)
   * @returns {string} Safe, filesystem-compatible string
   */
  function sanitizeSegment(value) {
    if (!value) return '_';

    // Decode URL-encoded characters and strip whitespace
    let text = decodeURIComponent(value).trim();

    // Replace filesystem-illegal characters with underscores
    text = text.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

    // Remove leading/trailing spaces and dots
    text = text.replace(/^[\s.]+|[\s.]+$/g, '');

    // Ensure non-empty result
    if (!text) {
      text = '_';
    }

    // Prefix Windows reserved names with underscore
    if (WINDOWS_RESERVED_NAMES.has(text.toUpperCase())) {
      text = `_${text}`;
    }

    return text;
  }

  /**
   * Determine file extension from MIME type.
   * 
   * Maps MIME types to appropriate file extensions. Includes special handling
   * for JavaScript and image formats that may have multiple standard extensions.
   * 
   * @param {string} mimeType - MIME type string (e.g., "application/json")
   * @returns {string} File extension with leading dot (e.g., ".json"), or empty string
   */
  function extensionFromMime(mimeType) {
    if (!mimeType) return '';

    // Normalize: extract base MIME type before any parameters
    const mime = mimeType.split(';')[0].trim().toLowerCase();

    // Check explicit mappings first
    if (MIME_EXTENSIONS[mime]) {
      return MIME_EXTENSIONS[mime];
    }

    // Fallback: try to guess from standard library patterns
    if (mime.includes('javascript')) return '.js';
    if (mime.includes('json')) return '.json';
    if (mime.includes('html')) return '.html';
    if (mime.includes('xml')) return '.xml';
    if (mime.includes('text')) return '.txt';
    if (mime.includes('image/')) {
      const type = mime.split('/')[1];
      return type && type !== 'svg+xml' ? `.${type}` : '.svg';
    }

    return '';
  }

  /**
   * Normalize a query string by sorting parameters alphabetically.
   * 
   * Ensures that query strings with the same parameters in different orders
   * produce identical hashes. For example:
   *   ?id=123&sort=name and ?sort=name&id=123 → ?id=123&sort=name
   * 
   * @param {string} queryString - Query string to normalize (e.g., "?id=123&sort=name")
   * @returns {string} Normalized query string with sorted parameters
   */
  function normalizeQueryString(queryString) {
    if (!queryString || queryString === '?') {
      return '';
    }

    // Remove leading '?' if present
    const cleanQuery = queryString.startsWith('?') ? queryString.substring(1) : queryString;
    
    // Split by '&', sort, and rejoin
    const params = cleanQuery.split('&')
      .filter(p => p.length > 0) // Remove empty strings
      .sort();
    
    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  /**
   * Build a relative filesystem path from a URL.
   * 
   * Parses the URL, sanitizes each component, determines the appropriate
   * file extension from MIME type, and constructs a path that mirrors the
   * original URL structure. For directory URLs (ending with /), creates
   * an "index" file.
   * 
   * @param {string} url - Full URL to process
   * @param {string} mimeType - Response MIME type for extension detection
   * @param {boolean} includeQuerySuffix - If true, append query-string hash to filename
   * @returns {string} Relative filesystem path with sanitized components
   */
  function buildRelativeOutputPath(url, mimeType = '', includeQuerySuffix = false) {
    try {
      const urlObj = new URL(url);
      
      // Parse URL into components
      const scheme = sanitizeSegment(urlObj.protocol.replace(':', '') || 'unknown-scheme');
      const host = sanitizeSegment(urlObj.hostname || 'unknown-host');
      
      // Sanitize path segments and filter empty ones
      const pathSegments = urlObj.pathname
        .split('/')
        .filter(seg => seg)
        .map(sanitizeSegment);

      // Detect if URL points to a directory (ends with /) or is empty
      const endsWithSlash = urlObj.pathname.endsWith('/') || pathSegments.length === 0;
      const extension = extensionFromMime(mimeType);

      let fileName = endsWithSlash ? 'index' : pathSegments.pop() || 'index';

      // Optionally append query-string hash to make files with different queries distinct
      if (includeQuerySuffix && urlObj.search) {
        // Normalize query string to ensure consistent hashing regardless of parameter order
        const normalizedQuery = normalizeQueryString(urlObj.search);
        const queryHash = hashString(normalizedQuery).substring(0, 10);
        fileName = `${fileName}__q_${queryHash}`;
      }

      // Append file extension if not already present
      if (extension && !getExtension(fileName)) {
        fileName += extension;
      }

      // Construct path: scheme/host/path/to/filename
      const pathParts = [scheme, host, ...pathSegments, fileName];
      return pathParts.join('/');
    } catch (error) {
      // Fallback for invalid URLs
      console.warn(`Invalid URL: ${url}`, error);
      return `unknown/invalid/${sanitizeSegment(url.substring(0, 50))}`;
    }
  }

  /**
   * Synchronous hash function for generating query string hashes.
   * Uses a DJB2-based algorithm that produces consistent results across environments.
   * 
   * @param {string} str - String to hash
   * @returns {string} Hexadecimal hash string
   */
  function hashString(str) {
    // Use Node.js crypto if available for SHA-1
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.createHash('sha1').update(str).digest('hex');
      } catch (e) {
        // Fallback below
      }
    }

    // Deterministic hash (DJB2 variant) — works everywhere synchronously
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return combined.toString(16).padStart(16, '0');
  }

  /**
   * Get file extension from filename
   * 
   * @param {string} fileName - Filename to check
   * @returns {string} Extension (e.g., ".js") or empty string
   */
  function getExtension(fileName) {
    const match = fileName.match(/\.[^.]+$/);
    return match ? match[0] : '';
  }

  /**
   * Extract and decode response content from HAR content object.
   * 
   * Retrieves the text field and decodes it based on the encoding specified
   * in the HAR entry. Supports base64 and UTF-8 encodings.
   * 
   * @param {Object} content - Content object from HAR response
   * @returns {Uint8Array|null} Decoded bytes, or null if no text content
   */
  function decodeContentBytes(content) {
    if (!content || !content.text) {
      return null;
    }

    const text = content.text;
    const encoding = (content.encoding || '').toLowerCase();

    try {
      if (encoding === 'base64') {
        // Decode base64 string to bytes
        const binaryString = atob(text);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      } else {
        // UTF-8 encoding
        const encoder = new TextEncoder();
        return encoder.encode(text);
      }
    } catch (error) {
      console.error('Error decoding content:', error);
      return null;
    }
  }

  /**
   * Process a HAR object and extract all response content.
   * 
   * Parses HAR data structure, extracts response payloads, and builds a map
   * of file paths to content. Returns statistics on processing results.
   * 
   * When includeQuerySuffix is enabled, query parameters are hashed and appended
   * to filenames, ensuring different content served by the same endpoint with
   * different query parameters are captured as separate files. If the same
   * file+queryhash combination is encountered multiple times, the first occurrence
   * is retained.
   * 
   * @param {Object} harData - Parsed HAR object (from JSON.parse)
   * @param {Object} options - Processing options
   * @param {boolean} options.includeQuerySuffix - Include query-string hashes in filenames
   * @param {Function} options.onProgress - Optional callback for progress updates
   * @param {Function} options.generateQueryManifest - Generate query manifest for replay/triage
   * @returns {Promise<Object>} Object with { files, stats, queryMap, queryManifest }
   *   files: Map of filepath -> Uint8Array content
  *   stats: { extracted, skipped, failed, harName }
   *   queryMap: Map of filePath -> original query string (e.g., "?id=123&sort=name")
   *   queryManifest: Manifest of query parameters (when generateQueryManifest=true)
   */
  async function extractFilesFromHar(harData, options = {}) {
    const {
      includeQuerySuffix = false,
      generateQueryManifest = false,
      onProgress = null,
      harName = 'export'
    } = options;

    const files = new Map(); // filepath -> content
    const queryMap = new Map(); // filePath -> original query string
    const queryManifestEntries = []; // manifest entries for replay/triage
    const processingLog = []; // log of each entry's processing result
    const stats = {
      extracted: 0,
      skipped: 0,
      failed: 0,
      harName
    };

    // Extract request/response entries from HAR structure
    const entries = harData?.log?.entries || [];

    // Process each entry
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const request = entry.request || {};
      const response = entry.response || {};
      const content = response.content || {};

      const url = request.url || '';
      const mimeType = content.mimeType || '';

      // Update progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: entries.length,
          status: 'processing'
        });
      }

      // Skip entries with no URL
      if (!url) {
        stats.skipped++;
        processingLog.push({ index: i, url: '(empty)', status: 'skipped', reason: 'No URL in request' });
        continue;
      }

      try {
        // Decode response content
        const payload = decodeContentBytes(content);
        if (!payload) {
          // Skip entries with no content
          stats.skipped++;
          processingLog.push({ index: i, url, status: 'skipped', reason: 'No response content (empty body or missing text)', httpStatus: response.status });
          continue;
        }

        // Extract query string from URL for reverse lookup
        const urlObj = new URL(url);
        const queryString = urlObj.search; // e.g., "?id=123&sort=name"

        // Build output path mirroring original URL structure
        // When includeQuerySuffix is false, query strings are ignored in path generation
        // so multiple URLs with different queries map to same path.
        const uniquePath = buildRelativeOutputPath(url, mimeType, includeQuerySuffix);

        // Keep only first occurrence of a file path. Subsequent occurrences are skipped.
        // - If includeQuerySuffix=true: different queries produce different paths (no collision)
        // - If includeQuerySuffix=false: same base URL with different queries collides, first content is kept
        if (files.has(uniquePath)) {
          stats.skipped++;
          processingLog.push({ index: i, url, status: 'skipped', reason: 'Duplicate path (first occurrence already extracted)', filePath: uniquePath });
          continue;
        }

        // Store file content
        files.set(uniquePath, payload);
        processingLog.push({ index: i, url, status: 'extracted', filePath: uniquePath, mimeType, size: payload.length });
        
        // Store query string mapping if has query parameters
        if (queryString) {
          queryMap.set(uniquePath, queryString);
          
          // Generate manifest entry for replay/triage if enabled
          if (generateQueryManifest) {
            const baseUrl = new URL(url);
            baseUrl.search = ''; // Remove query string to get base URL
            
            queryManifestEntries.push({
              baseUrl: baseUrl.toString(),
              originalQuery: queryString,
              normalizedQuery: normalizeQueryString(queryString),
              hash: includeQuerySuffix ? hashString(normalizeQueryString(queryString)).substring(0, 10) : null,
              filePath: uniquePath,
              mimeType: mimeType
            });
          }
        }
        
        stats.extracted++;
      } catch (error) {
        // Count any processing errors
        console.error(`Error processing ${url}:`, error);
        stats.failed++;
        processingLog.push({ index: i, url, status: 'failed', reason: error.message });
      }
    }

    // Generate query manifest if requested
    let queryManifest = null;
    if (generateQueryManifest && queryManifestEntries.length > 0) {
      queryManifest = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        harName: harName,
        totalEntries: queryManifestEntries.length,
        queryParameters: queryManifestEntries
      };
    }

    return { files, stats, queryMap, queryManifest, processingLog };
  }

  /**
   * Create a ZIP archive from files map
   * 
   * @param {Map<string, Uint8Array>} files - Map of filepath -> content
   * @param {string} harName - Name for the root folder in ZIP
   * @param {Object} queryManifest - Optional query parameter manifest to include in ZIP
   * @param {Array} processingLog - Optional processing log to include in ZIP
   * @returns {Promise<JSZip>} JSZip object
   */
  async function createZipArchive(files, harName = 'export', queryManifest = null, processingLog = null) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip is required. Include jszip.min.js in your HTML.');
    }

    const zip = new JSZip();
    const root = zip.folder(harName);

    for (const [filePath, content] of files) {
      root.file(filePath, content);
    }

    // Include query manifest if provided
    if (queryManifest) {
      root.file('_query-manifest.json', JSON.stringify(queryManifest, null, 2));
    }

    // Include processing log if provided
    if (processingLog) {
      root.file('_processing-log.json', JSON.stringify(processingLog, null, 2));
    }

    return zip;
  }

  /**
   * Extract files from HAR data and create downloadable ZIP archive
   * 
   * Combines extractFilesFromHar and createZipArchive for convenience.
   * If generateQueryManifest is enabled, includes _query-manifest.json in the ZIP.
   * 
   * @param {Object} harData - Parsed HAR object
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} { zip, stats, queryMap, queryManifest, processingLog, fileCount }
   */
  async function extractFilesFromHarAsZip(harData, options = {}) {
    const { files, stats, queryMap, queryManifest, processingLog } = await extractFilesFromHar(harData, options);
    const zip = await createZipArchive(files, stats.harName, queryManifest, processingLog);
    return { zip, stats, queryMap, queryManifest, processingLog, fileCount: files.size };
  }

  /**
   * Public API
   */
  return {
    sanitizeSegment,
    extensionFromMime,
    normalizeQueryString,
    buildRelativeOutputPath,
    decodeContentBytes,
    extractFilesFromHar,
    createZipArchive,
    extractFilesFromHarAsZip,
    hashString,
    WINDOWS_RESERVED_NAMES,
    MIME_EXTENSIONS
  };
})();

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HarExtractCore;
}
