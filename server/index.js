/**
 * Yuki server — static site + Inworld Realtime WebSocket proxy
 *
 * Browser ←WebSocket→ this server ←WebSocket→ Inworld API
 *
 * INWORLD_API_KEY is read from process.env only — never sent to the client.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env") });

const PORT = Number(process.env.PORT) || 8787;
const INWORLD_API_KEY = process.env.INWORLD_API_KEY || "";
const INWORLD_WS_BASE = "wss://api.inworld.ai/api/v1/realtime/session";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/health") {
    setCors(req, res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, inworld: !!INWORLD_API_KEY }));
    return;
  }
  serveStatic(req, res);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (pathname !== "/realtime") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (clientWs) => {
    wss.emit("connection", clientWs, req);
  });
});

wss.on("connection", (clientWs) => {
  if (!INWORLD_API_KEY) {
    clientWs.send(
      JSON.stringify({
        type: "error",
        error: { message: "INWORLD_API_KEY is not configured on the server." },
      })
    );
    clientWs.close(1011, "missing-api-key");
    return;
  }

  const sessionKey = `voice-${Date.now()}`;
  const upstreamUrl = `${INWORLD_WS_BASE}?key=${encodeURIComponent(sessionKey)}&protocol=realtime`;

  const upstream = new WebSocket(upstreamUrl, {
    headers: {
      Authorization: `Basic ${INWORLD_API_KEY}`,
    },
  });

  let upstreamOpen = false;
  const pending = [];

  const forwardToUpstream = (text) => {
    if (upstreamOpen && upstream.readyState === WebSocket.OPEN) {
      upstream.send(text);
    } else {
      pending.push(text);
    }
  };

  upstream.on("open", () => {
    upstreamOpen = true;
    while (pending.length) upstream.send(pending.shift());
  });

  upstream.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString("utf8");
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(text);
  });

  upstream.on("error", (err) => {
    console.error("[proxy] upstream error:", err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "error", error: { message: err.message } }));
    }
  });

  upstream.on("close", (code, reason) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code || 1000, reason.toString());
    }
  });

  clientWs.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString("utf8");
    forwardToUpstream(text);
  });

  clientWs.on("close", () => {
    if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
      upstream.close();
    }
  });

  clientWs.on("error", (err) => {
    console.error("[proxy] client error:", err.message);
    upstream.close();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Yuki server  http://localhost:${PORT}`);
  console.log(`Companion    http://localhost:${PORT}/companion.html`);
  console.log(`WebSocket    ws://localhost:${PORT}/realtime`);
  if (!INWORLD_API_KEY) {
    console.warn("WARNING: INWORLD_API_KEY is not set — voice chat will not connect.");
  }
});
