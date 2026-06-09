/** Test Inworld JWT minting (uses .env INWORLD_API_KEY) */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { mintInworldJwt, resolveApiKey } from "../lib/inworld-jwt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

if (!resolveApiKey()) {
  console.error("FAIL: INWORLD_API_KEY not set in .env");
  process.exit(1);
}

try {
  const jwt = await mintInworldJwt();
  console.log("SUCCESS: JWT minted, expires", jwt.expirationTime);
} catch (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
}
