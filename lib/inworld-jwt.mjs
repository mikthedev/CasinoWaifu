/**
 * Mint Inworld JWT from INWORLD_API_KEY (base64 key:secret) — Vercel serverless safe.
 */
import crypto from "crypto";

export function resolveApiKey() {
  const basic = (process.env.INWORLD_API_KEY || "").trim();
  if (basic) {
    const decoded = Buffer.from(basic, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const key = idx > 0 ? decoded.slice(0, idx) : "";
    const secret = idx > 0 ? decoded.slice(idx + 1) : "";
    if (key && secret) return { key, secret };
  }
  const key = (process.env.INWORLD_KEY || "").trim();
  const secret = (process.env.INWORLD_SECRET || "").trim();
  if (key && secret) return { key, secret };
  return null;
}

function getSignatureKey(secret, params) {
  let key = Buffer.from(`IW1${secret}`, "utf8");
  for (const p of params) {
    key = crypto.createHmac("sha256", key).update(p, "utf8").digest();
  }
  return crypto.createHmac("sha256", key).update("iw1_request", "utf8").digest("hex");
}

function buildAuthHeader(apiKey) {
  const host = process.env.INWORLD_HOST || "api.inworld.ai";
  const engineHost = (process.env.INWORLD_ENGINE_HOST || "api-engine.inworld.ai").replace(
    ":443",
    ""
  );
  const path = "/ai.inworld.engine.WorldEngine/GenerateToken";
  const method = path.slice(1);
  const datetime = new Date().toISOString().split("T")[0].replace(/-/g, "") +
    new Date().toISOString().split("T")[1].replace(/:/g, "").slice(0, 6);
  const nonce = crypto.randomBytes(16).toString("hex").slice(1, 12);
  const signature = getSignatureKey(apiKey.secret, [datetime, engineHost, method, nonce]);
  return `IW1-HMAC-SHA256 ApiKey=${apiKey.key},DateTime=${datetime},Nonce=${nonce},Signature=${signature}`;
}

/** @returns {Promise<{ token: string, type: string, expirationTime?: string }>} */
export async function mintInworldJwt() {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error("INWORLD_API_KEY not configured");

  const host = process.env.INWORLD_HOST || "api.inworld.ai";
  const workspace = process.env.INWORLD_WORKSPACE?.trim();
  const resources = workspace ? [workspace] : [];

  const res = await fetch(`https://${host}/auth/v1/tokens/token:generate`, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key: apiKey.key, resources }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`JWT mint failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchIceServers(token) {
  const res = await fetch("https://api.inworld.ai/v1/realtime/ice-servers", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.ice_servers || [];
}
