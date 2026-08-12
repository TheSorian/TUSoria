import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/eta.js';

describe('/api/eta Proxy', () => {
  let mockReq;
  let mockRes;
  const originalFetch = global.fetch;
  const originalDateNow = Date.now;

  beforeEach(() => {
    mockReq = {
      query: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn()
    };
    global.fetch = vi.fn();
    // Prevent time from moving during cache tests
    global.Date.now = vi.fn(() => 1000000);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.Date.now = originalDateNow;
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('returns 400 when stopId is missing', async () => {
      await handler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'invalid stopId parameter' });
    });

    it('returns 400 for completely invalid stopIds (e.g. scripts or special chars)', async () => {
      mockReq.query.stopId = '<script>alert(1)</script>';
      await handler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.query.stopId = '123-abc';
      await handler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('proceeds for valid numeric and alphanumeric stopIds', async () => {
      mockReq.query.stopId = '1';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"jsontraffics2":"[]"}'
      });
      await handler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      mockReq.query.stopId = 'LC1';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"jsontraffics2":"[]"}'
      });
      await handler(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Upstream Responses', () => {
    it('handles HTTP 200 with valid JSON correctly', async () => {
      mockReq.query.stopId = '11';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ jsontraffics2: "[{}]" })
      });
      
      await handler(mockReq, mockRes);
      
      expect(global.fetch).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ jsontraffics2: "[{}]" });
    });

    it('handles HTTP 200 with empty body gracefully (no 500 crash)', async () => {
      mockReq.query.stopId = '3';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '' // Avanza returns empty body sometimes
      });
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ jsontraffics2: "[]" });
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Cache-Status', 'MISS-FETCHED-EMPTY');
    });

    it('handles HTTP 200 with invalid JSON gracefully', async () => {
      mockReq.query.stopId = '4';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '<html>Not a JSON</html>'
      });
      
      await handler(mockReq, mockRes);
      
      // Should not crash, should return 502 Bad Gateway
      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Avanza server returned invalid JSON' });
    });

    it('handles HTTP 500 upstream errors gracefully', async () => {
      mockReq.query.stopId = '5';
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Avanza server returned HTTP 500' });
    });

    it('handles Fetch/Network errors gracefully', async () => {
      mockReq.query.stopId = '6';
      global.fetch.mockRejectedValueOnce(new Error('ECONNRESET'));
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(502);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to reach Avanza server' });
    });
  });

  describe('Compatibility & Structure', () => {
    it('ensures the returned object always has jsontraffics2 to maintain compatibility', async () => {
      mockReq.query.stopId = '7';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"otherField":"data"}'
      });
      
      await handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({ otherField: 'data', jsontraffics2: '[]' });
    });
  });
});
