/** @type {import('@vercel/node').VercelRequest} */
function httpsToWss(base) {
  if (!base) return null;
  const trimmed = base.trim().replace(/\/$/, "");
  const wsBase = trimmed.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  return `${wsBase}/realtime`;
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const backend = process.env.VOICE_BACKEND_URL?.trim().replace(/\/$/, "") || null;
  const proxy = process.env.VOICE_PROXY_URL?.trim() || null;
  const wsUrl = proxy || httpsToWss(backend);

  res.status(200).json({
    wsUrl: wsUrl || null,
    voiceBackendUrl: backend || null,
    voiceBackend: !!(backend || proxy),
    // INWORLD_API_KEY on Vercel does NOT run WebSockets — it must live on Railway
    hasInworldKeyOnVercel: Boolean(process.env.INWORLD_API_KEY),
  });
}
