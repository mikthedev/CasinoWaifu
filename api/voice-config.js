import { resolveApiKey } from "../lib/inworld-jwt.mjs";

/** @type {import('@vercel/node').VercelRequest} */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const hasKey = !!resolveApiKey();
  const backend = process.env.VOICE_BACKEND_URL?.trim().replace(/\/$/, "") || null;
  const proxy = process.env.VOICE_PROXY_URL?.trim() || null;
  const wsUrl =
    proxy ||
    (backend
      ? backend.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/realtime"
      : null);

  // Prefer WebRTC on Vercel (no Railway needed). Legacy Railway proxy still supported.
  const mode = hasKey ? "webrtc" : wsUrl ? "proxy" : "none";

  res.status(200).json({
    mode,
    wsUrl: mode === "proxy" ? wsUrl : null,
    voiceBackendUrl: backend || null,
    voiceBackend: mode !== "none",
    webrtcConfigUrl: "/api/webrtc-config",
    hasInworldKey: hasKey,
  });
}
