export interface HarContent {
  text?: string;
  encoding?: string;
  mimeType?: string;
  size?: number;
}

export interface HarResponse {
  status?: number;
  content?: HarContent;
}

export interface HarRequest {
  method?: string;
  url?: string;
}

export interface HarEntry {
  request?: HarRequest;
  response?: HarResponse;
}

export interface HarLog {
  entries?: HarEntry[];
}

export interface HarData {
  log?: HarLog;
}

export interface ProgressUpdate {
  current: number;
  total: number;
  status: string;
}

export interface ExtractOptions {
  includeQuerySuffix?: boolean;
  generateQueryManifest?: boolean;
  onProgress?: (progress: ProgressUpdate) => void;
  harName?: string;
}

export interface ExtractStats {
  extracted: number;
  skipped: number;
  failed: number;
  harName: string;
}

export interface QueryManifestEntry {
  baseUrl: string;
  originalQuery: string;
  normalizedQuery: string;
  hash: string | null;
  filePath: string;
  mimeType: string;
}

export interface QueryManifest {
  version: string;
  generatedAt: string;
  harName: string;
  totalEntries: number;
  queryParameters: QueryManifestEntry[];
}

export interface ProcessingLogEntry {
  index: number;
  url: string;
  status: "extracted" | "skipped" | "failed";
  reason?: string;
  filePath?: string;
  mimeType?: string;
  size?: number;
  httpStatus?: number;
}

export interface ExtractResult {
  files: Map<string, Uint8Array>;
  stats: ExtractStats;
  queryMap: Map<string, string>;
  queryManifest: QueryManifest | null;
  processingLog: ProcessingLogEntry[];
}

export interface ExtractZipResult {
  zip: any;
  stats: ExtractStats;
  queryMap: Map<string, string>;
  queryManifest: QueryManifest | null;
  processingLog: ProcessingLogEntry[];
  fileCount: number;
}

export interface HarExtractCoreApi {
  sanitizeSegment(value: string): string;
  extensionFromMime(mimeType: string): string;
  normalizeQueryString(queryString: string): string;
  buildRelativeOutputPath(url: string, mimeType?: string, includeQuerySuffix?: boolean): string;
  decodeContentBytes(content: HarContent): Uint8Array | null;
  extractFilesFromHar(harData: HarData, options?: ExtractOptions): Promise<ExtractResult>;
  createZipArchive(
    files: Map<string, Uint8Array>,
    harName?: string,
    queryManifest?: QueryManifest | null,
    processingLog?: ProcessingLogEntry[] | null
  ): Promise<any>;
  extractFilesFromHarAsZip(harData: HarData, options?: ExtractOptions): Promise<ExtractZipResult>;
  hashString(str: string): string;
  WINDOWS_RESERVED_NAMES: Set<string>;
  MIME_EXTENSIONS: Record<string, string>;
}

declare const HarExtractCore: HarExtractCoreApi;

export = HarExtractCore;
