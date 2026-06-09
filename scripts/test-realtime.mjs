/**
 * Quick smoke test: proxy → Inworld Realtime handshake
 */
import WebSocket from "ws";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const WS_URL = "ws://localhost:8787/realtime";
const TIMEOUT_MS = 20000;

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    model: "inworld/llm-playground-export-2026-06-09",
    instructions: "You are Yuki, a friendly companion. Say hi briefly.",
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: "assemblyai/u3-rt-pro" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "medium",
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { model: "inworld-tts-2", voice: "Abby" },
    },
  },
};

console.log("Connecting to proxy:", WS_URL);

const ws = new WebSocket(WS_URL);
let gotCreated = false;
let gotUpdated = false;

const timer = setTimeout(() => {
  console.error("FAIL: timed out waiting for session.updated");
  ws.close();
  process.exit(1);
}, TIMEOUT_MS);

ws.on("open", () => console.log("Client WS open"));

ws.on("message", (raw) => {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  console.log("←", msg.type);

  if (msg.type === "session.created") {
    gotCreated = true;
    ws.send(JSON.stringify(sessionUpdate));
    console.log("→ session.update sent");
  }

  if (msg.type === "session.updated") {
    gotUpdated = true;
    clearTimeout(timer);
    console.log("SUCCESS: Inworld Realtime session is ready.");
    ws.close();
    process.exit(0);
  }

  if (msg.type === "error") {
    clearTimeout(timer);
    console.error("FAIL:", JSON.stringify(msg));
    ws.close();
    process.exit(1);
  }
});

ws.on("error", (err) => {
  clearTimeout(timer);
  console.error("FAIL: WebSocket error:", err.message);
  process.exit(1);
});

ws.on("close", (code, reason) => {
  if (!gotUpdated) {
    clearTimeout(timer);
    console.error(`FAIL: closed before session.updated (code=${code}, reason=${reason})`);
    process.exit(1);
  }
});
