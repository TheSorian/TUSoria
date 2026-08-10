import https from 'https';

export default async function handler(req, res) {
  const { stopId } = req.query;

  if (!stopId) {
    return res.status(400).json({ error: 'stopId parameter is required' });
  }

  const endpoint = `https://soria.avanzagrupo.com/detalleparada?p_p_id=adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC_cmd=getETAS`;

  const bodyData = new URLSearchParams({
    "_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_cjPafX1mEmsC_busStopID": String(stopId)
  }).toString();

  try {
    // Agent to bypass Avanza's SSL certificate chain verification issue
    const agent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      body: bodyData,
      agent
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Avanza server returned HTTP ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=5');
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error querying Avanza API in Vercel serverless proxy:", error);
    return res.status(500).json({ error: error.message });
  }
}
