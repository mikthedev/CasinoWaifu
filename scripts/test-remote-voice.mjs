/**
 * Test voice WebSocket on a remote host (Railway).
 * Usage: node scripts/test-remote-voice.mjs https://your-app.up.railway.app
 */
import WebSocket from "ws";

const base = process.argv[2]?.trim().replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/test-remote-voice.mjs https://your-app.up.railway.app");
  process.exit(1);
}

const healthUrl = `${base}/health`;
const wsUrl = base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/realtime";

console.log("1. Health check:", healthUrl);
try {
  const res = await fetch(healthUrl, { cache: "no-store" });
  const body = await res.text();
  console.log("   Status:", res.status, body);
  if (!res.ok) {
    console.error("FAIL: health endpoint returned", res.status);
    process.exit(1);
  }
  const data = JSON.parse(body);
  if (!data.inworld) {
    console.error("FAIL: Railway is up but INWORLD_API_KEY is not set on Railway");
    process.exit(1);
  }
} catch (err) {
  console.error("FAIL: cannot reach Railway —", err.message);
  console.error("   → Deploy server/index.js to Railway and enable public networking");
  process.exit(1);
}

console.log("2. WebSocket:", wsUrl);

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    model: "inworld/llm-playground-export-2026-06-09",
    instructions: "You are Yuki.",
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: "assemblyai/u3-rt-pro" },
        turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true },
      },
      output: { model: "inworld-tts-2", voice: "Abby" },
    },
  },
};

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out after 25s")), 25000);
  const ws = new WebSocket(wsUrl);

  ws.on("open", () => console.log("   WS open"));
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    console.log("   ←", msg.type);
    if (msg.type === "session.created") ws.send(JSON.stringify(sessionUpdate));
    if (msg.type === "session.updated") {
      clearTimeout(timer);
      console.log("SUCCESS: Remote voice server is working.");
      ws.close();
      resolve();
    }
    if (msg.type === "error") {
      clearTimeout(timer);
      reject(new Error(JSON.stringify(msg)));
    }
  });
  ws.on("error", (err) => {
    clearTimeout(timer);
    reject(err);
  });
  ws.on("close", (code, reason) => {
    if (code !== 1000) {
      clearTimeout(timer);
      reject(new Error(`closed code=${code} reason=${reason || "none"}`));
    }
  });
}).catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
