/**
 * End-to-end test: session + greeting response with audio
 */
import WebSocket from "ws";

const WS_URL = "ws://localhost:8787/realtime";
const TIMEOUT_MS = 30000;

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    model: "inworld/llm-playground-export-2026-06-09",
    instructions: "You are Yuki, a friendly companion. Keep replies very short.",
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

let gotAudio = false;
let gotTranscript = false;

const ws = new WebSocket(WS_URL);
const timer = setTimeout(() => {
  console.error("FAIL: timed out");
  ws.close();
  process.exit(1);
}, TIMEOUT_MS);

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type !== "response.output_audio.delta") console.log("←", msg.type);

  if (msg.type === "session.created") {
    ws.send(JSON.stringify(sessionUpdate));
  }
  if (msg.type === "session.updated") {
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Say hi briefly." }],
        },
      })
    );
    ws.send(JSON.stringify({ type: "response.create" }));
  }
  if (msg.type === "response.output_audio.delta" && (msg.delta || msg.audio)) {
    gotAudio = true;
  }
  if (
    (msg.type === "response.output_audio_transcript.delta" ||
      msg.type === "response.output_text.delta") &&
    msg.delta
  ) {
    gotTranscript = true;
    process.stdout.write(msg.delta);
  }
  if (msg.type === "response.done") {
    clearTimeout(timer);
    console.log("\n");
    if (gotAudio) {
      console.log("SUCCESS: received audio response from Yuki.");
      ws.close();
      process.exit(0);
    }
    console.error("FAIL: response.done but no audio deltas");
    ws.close();
    process.exit(1);
  }
  if (msg.type === "error") {
    clearTimeout(timer);
    console.error("FAIL:", JSON.stringify(msg));
    process.exit(1);
  }
});

ws.on("error", (e) => {
  clearTimeout(timer);
  console.error("FAIL:", e.message);
  process.exit(1);
});
