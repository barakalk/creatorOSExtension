export const API_BASE = 'http://localhost:3000'; // changeable
// export const WHITELIST_ENDPOINT = `${API_BASE}/api/whitelist`;
export const MAX_DOM_BYTES = 1_500_000; // ~1.5MB
export const DEBUG = true;

// Demo mode: when true, API calls are mocked so you can test without a backend
export const DEMO_MODE = true;

// Cache duration for whitelist in milliseconds (10 minutes)
export const WHITELIST_CACHE_DURATION = 10 * 60 * 1000;

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Storage keys
export const STORAGE_KEYS = {
  WHITELIST_CACHE: 'whitelist_cache',
  WHITELIST_CACHE_TIMESTAMP: 'whitelist_cache_timestamp',
  CAPTURE_TOGGLE_PREFIX: 'host:', // followed by hostname:captureEnabled
} as const;