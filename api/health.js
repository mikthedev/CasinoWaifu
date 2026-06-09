import { resolveApiKey } from "../lib/inworld-jwt.mjs";

/** @type {import('@vercel/node').VercelRequest} */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const hasKey = !!resolveApiKey();
  res.status(200).json({
    ok: true,
    platform: "vercel",
    inworld: hasKey,
    voiceConfigured: hasKey || Boolean(process.env.VOICE_BACKEND_URL || process.env.VOICE_PROXY_URL),
    mode: hasKey ? "webrtc" : "proxy",
    note: hasKey
      ? "Voice uses WebRTC via INWORLD_API_KEY — no Railway needed"
      : "Set INWORLD_API_KEY on Vercel for voice (Railway not required)",
  });
}
