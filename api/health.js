/** @type {import('@vercel/node').VercelRequest} */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  res.status(200).json({
    ok: true,
    inworld: Boolean(process.env.INWORLD_API_KEY),
    voiceProxy: Boolean(process.env.VOICE_PROXY_URL),
  });
}
