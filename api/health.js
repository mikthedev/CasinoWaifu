/** @type {import('@vercel/node').VercelRequest} */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const voiceConfigured = Boolean(
    process.env.VOICE_BACKEND_URL || process.env.VOICE_PROXY_URL
  );
  res.status(200).json({
    ok: true,
    platform: "vercel-static",
    inworld: Boolean(process.env.INWORLD_API_KEY),
    voiceConfigured,
    voiceProxy: Boolean(process.env.VOICE_PROXY_URL),
    note: voiceConfigured
      ? "Voice backend URL is set"
      : "Set VOICE_BACKEND_URL to your Railway URL (INWORLD_API_KEY alone does not run voice)",
  });
}
