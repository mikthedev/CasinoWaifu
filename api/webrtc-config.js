import { fetchIceServers, mintInworldJwt, resolveApiKey } from "../lib/inworld-jwt.mjs";

/** @type {import('@vercel/node').VercelRequest} */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!resolveApiKey()) {
    res.status(503).json({
      ok: false,
      error: "Set INWORLD_API_KEY in Vercel → Settings → Environment Variables, then redeploy",
    });
    return;
  }

  try {
    const jwt = await mintInworldJwt();
    const token = jwt.token;
    const ice_servers = await fetchIceServers(token);

    res.status(200).json({
      ok: true,
      mode: "webrtc",
      token,
      tokenType: jwt.type || "Bearer",
      expirationTime: jwt.expirationTime || null,
      ice_servers,
      callsUrl: "https://api.inworld.ai/v1/realtime/calls",
    });
  } catch (err) {
    console.error("[webrtc-config]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
