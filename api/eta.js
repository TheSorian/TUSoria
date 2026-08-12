// In-memory cache for fast responses (20 seconds TTL)
const memoryCache = new Map();
const CACHE_TTL_MS = 20 * 1000; // 20 seconds TTL
const MAX_CACHE_SIZE = 500; // Prevent unbounded memory growth

// Periodic cleanup of expired cache entries (lazy cleanup when cache gets too large)
function enforceCacheLimit() {
  if (memoryCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL_MS) {
        memoryCache.delete(key);
      }
    }
    // If still too large, delete oldest entries until we're under the limit
    if (memoryCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toDelete = entries.slice(0, memoryCache.size - MAX_CACHE_SIZE);
      toDelete.forEach(([key]) => memoryCache.delete(key));
    }
  }
}

export default async function handler(req, res) {
  const { stopId } = req.query;

  // 1. Validate stopId (must exist and be alphanumeric to prevent injection/garbage)
  if (!stopId || typeof stopId !== 'string' || !/^[a-zA-Z0-9_]+$/.test(stopId)) {
    console.warn(`[API ETA] invalid stopId: ${stopId}`);
    return res.status(400).json({ error: 'invalid stopId parameter' });
  }

  const now = Date.now();
  const cached = memoryCache.get(stopId);

  // Return from in-memory cache if fresh
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    // CORS is kept as '*' because the app might be consumed from local dev, Vercel Previews, or the main prod domain.
    // Changing to a strict domain speculatively could break local dev without Vite proxy setup.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=20, s-maxage=20, stale-while-revalidate=60');
    res.setHeader('X-Cache-Status', 'HIT-MEMORY');
    return res.status(200).json(cached.data);
  }

  const endpoint = `https://soria.avanzagrupo.com/detalleparada?p_p_id=adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC_cmd=getETAS`;

  const bodyData = new URLSearchParams({
    "_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC_busStopID": String(stopId)
  }).toString();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TUSoria/1.0'
      },
      body: bodyData
    });

    if (!response.ok) {
      console.error(`[API ETA] upstream HTTP error: ${response.status} for stopId: ${stopId}`);
      if (cached) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Cache-Status', 'EXPIRED-FALLBACK');
        return res.status(200).json(cached.data);
      }
      return res.status(response.status).json({ error: `Avanza server returned HTTP ${response.status}` });
    }

    const rawText = await response.text();

    // Handle empty body gracefully without crashing
    if (!rawText || rawText.trim() === '') {
      console.log(`[API ETA] upstream empty body for stopId: ${stopId}`);
      const emptyDataset = { jsontraffics2: "[]" };
      
      memoryCache.set(stopId, { timestamp: now, data: emptyDataset });
      enforceCacheLimit();

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=20, s-maxage=20, stale-while-revalidate=60');
      res.setHeader('X-Cache-Status', 'MISS-FETCHED-EMPTY');
      return res.status(200).json(emptyDataset);
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error(`[API ETA] upstream invalid JSON for stopId: ${stopId}`);
      if (cached) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Cache-Status', 'EXPIRED-FALLBACK-JSON-ERROR');
        return res.status(200).json(cached.data);
      }
      return res.status(502).json({ error: 'Avanza server returned invalid JSON' });
    }

    // Minimal validation of response structure before caching
    if (typeof data !== 'object' || data === null) {
      data = { jsontraffics2: "[]" };
    } else if (!('jsontraffics2' in data)) {
      data.jsontraffics2 = "[]";
    }

    console.log(`[API ETA] upstream valid response for stopId: ${stopId}`);
    
    // Cache in memory
    memoryCache.set(stopId, { timestamp: now, data });
    enforceCacheLimit();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=20, s-maxage=20, stale-while-revalidate=60');
    res.setHeader('X-Cache-Status', 'MISS-FETCHED');
    return res.status(200).json(data);

  } catch (error) {
    console.error(`[API ETA] network error querying Avanza for stopId: ${stopId} - ${error.message}`);
    if (cached) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Cache-Status', 'EXPIRED-FALLBACK-ERROR');
      return res.status(200).json(cached.data);
    }
    return res.status(502).json({ error: 'Failed to reach Avanza server' });
  }
}
