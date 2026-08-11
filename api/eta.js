process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// In-memory cache for fast responses (3 seconds TTL)
const memoryCache = new Map();
const CACHE_TTL_MS = 3 * 1000; // 3 seconds TTL

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId) {
    return res.status(400).json({ error: 'stopId parameter is required' });
  }

  const now = Date.now();
  const cached = memoryCache.get(stopId);

  // Return from in-memory cache if fresh
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=3, stale-while-revalidate=10');
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: bodyData
    });

    if (!response.ok) {
      if (cached) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Cache-Status', 'EXPIRED-FALLBACK');
        return res.status(200).json(cached.data);
      }
      return res.status(response.status).json({ error: `Avanza server returned HTTP ${response.status}` });
    }

    const data = await response.json();

    // Cache in memory
    memoryCache.set(stopId, { timestamp: now, data });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=3, stale-while-revalidate=10');
    res.setHeader('X-Cache-Status', 'MISS-FETCHED');
    return res.status(200).json(data);
  } catch (error) {
    if (cached) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Cache-Status', 'EXPIRED-FALLBACK-ERROR');
      return res.status(200).json(cached.data);
    }
    console.error("Error querying Avanza API in Vercel serverless proxy:", error);
    return res.status(500).json({ error: error.message });
  }
}
