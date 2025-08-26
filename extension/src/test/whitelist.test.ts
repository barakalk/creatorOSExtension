import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
const mockChrome = {
  storage: {
    session: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

global.chrome = mockChrome as any;
global.fetch = vi.fn();

// Import after mocking
import { isWhitelisted, getHostCaptureToggle, setHostCaptureToggle } from '../whitelist';

describe('whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockChrome.storage.session.get.mockResolvedValue({});
    mockChrome.storage.session.set.mockResolvedValue(undefined);
    mockChrome.storage.sync.get.mockResolvedValue({});
    mockChrome.storage.sync.set.mockResolvedValue(undefined);
    
    // Mock fetch to return empty patterns by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  describe('pattern matching', () => {
    it('should match exact URLs', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://www.example.com/page' }
        ]),
      });

      const result = await isWhitelisted('https://www.example.com/page');
      expect(result).toBe(true);
    });

    it('should match wildcard patterns in host', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://*.example.com/*' }
        ]),
      });

      const result1 = await isWhitelisted('https://www.example.com/any/path');
      const result2 = await isWhitelisted('https://subdomain.example.com/page');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should match wildcard patterns in path', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://www.runwayml.com/*' }
        ]),
      });

      const result1 = await isWhitelisted('https://www.runwayml.com/');
      const result2 = await isWhitelisted('https://www.runwayml.com/create');
      const result3 = await isWhitelisted('https://www.runwayml.com/create/video');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should not match non-matching patterns', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://www.runwayml.com/*' }
        ]),
      });

      const result1 = await isWhitelisted('https://www.midjourney.com/');
      const result2 = await isWhitelisted('http://www.runwayml.com/'); // Different protocol
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle protocol wildcards', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: '*://www.example.com/*' }
        ]),
      });

      const result1 = await isWhitelisted('https://www.example.com/page');
      const result2 = await isWhitelisted('http://www.example.com/page');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('caching', () => {
    it('should use cached patterns when available and valid', async () => {
      const cachedPatterns = [{ pattern: 'https://cached.com/*' }];
      const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      
      mockChrome.storage.session.get.mockResolvedValue({
        whitelist_cache: cachedPatterns,
        whitelist_cache_timestamp: recentTimestamp,
      });

      const result = await isWhitelisted('https://cached.com/page');
      
      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled(); // Should use cache
    });

    it('should fetch fresh patterns when cache is expired', async () => {
      const expiredTimestamp = Date.now() - 15 * 60 * 1000; // 15 minutes ago
      
      mockChrome.storage.session.get.mockResolvedValue({
        whitelist_cache: [{ pattern: 'https://old.com/*' }],
        whitelist_cache_timestamp: expiredTimestamp,
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ pattern: 'https://fresh.com/*' }]),
      });

      const result = await isWhitelisted('https://fresh.com/page');
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalled(); // Should fetch fresh
    });
  });

  describe('host capture toggle', () => {
    it('should return true by default for new hosts', async () => {
      const result = await getHostCaptureToggle('example.com');
      expect(result).toBe(true);
    });

    it('should return stored toggle state', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        'host:example.com:captureEnabled': false,
      });

      const result = await getHostCaptureToggle('example.com');
      expect(result).toBe(false);
    });

    it('should save toggle state correctly', async () => {
      await setHostCaptureToggle('example.com', false);
      
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        'host:example.com:captureEnabled': false,
      });
    });
  });

  describe('integration with host toggle', () => {
    it('should respect host toggle even when pattern matches', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://example.com/*' }
        ]),
      });

      // Host toggle is disabled
      mockChrome.storage.sync.get.mockResolvedValue({
        'host:example.com:captureEnabled': false,
      });

      const result = await isWhitelisted('https://example.com/page');
      expect(result).toBe(false);
    });

    it('should return false when pattern does not match regardless of toggle', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { pattern: 'https://other.com/*' }
        ]),
      });

      // Host toggle is enabled
      mockChrome.storage.sync.get.mockResolvedValue({
        'host:example.com:captureEnabled': true,
      });

      const result = await isWhitelisted('https://example.com/page');
      expect(result).toBe(false);
    });
  });
});