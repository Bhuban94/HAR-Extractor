import cjsModule from './har-extract-core.js';

const HarExtractCore = cjsModule && cjsModule.default ? cjsModule.default : cjsModule;

export default HarExtractCore;
export const {
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
  MIME_EXTENSIONS,
} = HarExtractCore;
