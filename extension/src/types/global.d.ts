export interface WhitelistPattern {
  pattern: string;
}

export interface WhitelistResponse {
  patterns?: WhitelistPattern[];
}

export interface CaptureMetadata {
  title?: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  timestamp: number;
}

export interface CaptureDomPayload {
  url: string;
  domHtml: string;
  meta?: CaptureMetadata;
}

export interface CaptureResponse {
  id: string;
  domHash: string;
}

export interface CaptureToggleState {
  [hostname: string]: boolean;
}

export interface WhitelistCache {
  patterns: WhitelistPattern[];
  timestamp: number;
}

export interface StoredCaptureMeta {
  id: string;
  url: string;
  timestamp: number;
  sizeBytes: number;
  title?: string;
}

export type StorageListItem = StoredCaptureMeta;

// Chrome extension specific types
declare global {
  interface Window {
    chrome: typeof chrome;
  }
}