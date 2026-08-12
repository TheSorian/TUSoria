import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vercelApiProxyPlugin } from '../api/devProxy.js';
import etaHandler from '../api/eta.js';

vi.mock('../api/eta.js', () => ({
  default: vi.fn()
}));

describe('Vite Dev Proxy Adapter', () => {
  let plugin;
  let useMock;
  
  beforeEach(() => {
    vi.clearAllMocks();
    useMock = vi.fn();
    plugin = vercelApiProxyPlugin();
    plugin.configureServer({ middlewares: { use: useMock } });
  });

  it('registers the /api/eta middleware', () => {
    expect(useMock).toHaveBeenCalledTimes(1);
    expect(useMock.mock.calls[0][0]).toBe('/api/eta');
  });

  it('polyfills req.query and passes to handler (Case 1)', async () => {
    const middleware = useMock.mock.calls[0][1];
    
    const req = {
      url: '/api/eta?stopId=1&foo=bar',
      headers: { host: 'localhost:5173' }
    };
    const res = {
      setHeader: vi.fn(),
      end: vi.fn()
    };

    etaHandler.mockImplementationOnce(async (rq, rs) => {
      expect(rq.query).toEqual({ stopId: '1', foo: 'bar' });
      rs.status(200).json({ ok: true });
    });

    await middleware(req, res);
    
    expect(etaHandler).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
  });

  it('handles errors gracefully in the proxy', async () => {
    const middleware = useMock.mock.calls[0][1];
    
    const req = { url: '/api/eta', headers: { host: 'localhost:5173' } };
    const res = { setHeader: vi.fn(), end: vi.fn() };

    etaHandler.mockRejectedValueOnce(new Error('Handler crashed'));

    await middleware(req, res);
    
    expect(res.statusCode).toBe(500);
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Local proxy crash" }));
  });
});
