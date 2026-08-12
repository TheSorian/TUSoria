import etaHandler from './eta.js';

/**
 * Simple Vite middleware to polyfill Vercel's serverless API in local dev.
 * This ensures exact behavior parity without running a Vercel CLI server.
 */
export function vercelApiProxyPlugin() {
  return {
    name: 'vercel-api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/eta', async (req, res) => {
        try {
          // 1. Polyfill req.query
          const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
          req.query = Object.fromEntries(url.searchParams);

          // 2. Polyfill res.status()
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };

          // 3. Polyfill res.json()
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          // 4. Execute exact same logic used in production
          await etaHandler(req, res);
        } catch (err) {
          console.error("Local dev API error:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: "Local proxy crash" }));
          }
        }
      });
    }
  };
}
