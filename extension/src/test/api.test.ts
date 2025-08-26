import { describe, it, expect, beforeEach, vi } from 'vitest';
import { postCaptureDom, triggerParse } from '../api';

// Mock fetch
global.fetch = vi.fn();

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('postCaptureDom', () => {
    it('should successfully post DOM capture', async () => {
      const mockResponse = {
        id: 'capture-123',
        domHash: 'hash-abc',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const payload = {
        url: 'https://example.com',
        domHtml: '<html><body>Test</body></html>',
        meta: {
          title: 'Test Page',
          userAgent: 'Test Agent',
          viewport: { width: 1920, height: 1080 },
          timestamp: Date.now(),
        },
      };

      const result = await postCaptureDom(payload);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/capture/dom',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });

      const payload = {
        url: 'https://example.com',
        domHtml: '<html></html>',
      };

      await expect(postCaptureDom(payload)).rejects.toThrow('HTTP 400: Bad Request');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const payload = {
        url: 'https://example.com',
        domHtml: '<html></html>',
      };

      await expect(postCaptureDom(payload)).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      const payload = {
        url: 'https://example.com',
        domHtml: '<html></html>',
      };

      await expect(postCaptureDom(payload)).rejects.toThrow('Request timed out');
    });

    it('should validate response format', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const payload = {
        url: 'https://example.com',
        domHtml: '<html></html>',
      };

      await expect(postCaptureDom(payload)).rejects.toThrow('Invalid response: missing id or domHash');
    });
  });

  describe('triggerParse', () => {
    it('should successfully trigger parse', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
      });

      await triggerParse('capture-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/parse/capture-123',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      await expect(triggerParse('invalid-id')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(triggerParse('capture-123')).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockImplementation(() => {
        return new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(triggerParse('capture-123')).rejects.toThrow('Request timed out');
    });
  });
});