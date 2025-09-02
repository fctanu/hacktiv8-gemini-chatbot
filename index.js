// Backend server (index.js) - Express + Gemini Chat API
import dotenv from "dotenv";
// Load base .env then allow .env.local to override (your API key placed there)
dotenv.config(); // loads .env if present
dotenv.config({ path: ".env.local", override: true });
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import genaiPkg from "@google/genai";

// Support both class export names across versions
const { GoogleGenerativeAI, GoogleGenAI } = genaiPkg;
const GeminiClient = GoogleGenerativeAI || GoogleGenAI; // whichever exists

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
// ===== ESM __dirname setup (per reference) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend (index.html, script.js, style.css) from /public at root
app.use(express.static(path.join(__dirname, "public")));

// Lazy client (avoid throwing if key missing at startup)
function getClient() {
  if (!API_KEY) return null;
  return new GeminiClient(API_KEY ? { apiKey: API_KEY } : undefined);
}

// Robust response text extractor (future-proof against shape changes)
function extractText(resp) {
  try {
    const text =
      resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      resp?.candidates?.[0]?.content?.parts?.[0]?.text ??
      resp?.response?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") ??
      resp?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n");
    return text ?? JSON.stringify(resp, null, 2);
  } catch (err) {
    console.error("Error extracting text:", err);
    return JSON.stringify(resp, null, 2);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", model: GEMINI_MODEL, hasKey: Boolean(API_KEY) });
});

// POST /api/chat  { messages: [ { role: 'user'|'model', content: '...' }, ... ] }
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) throw new Error("messages must be an array");
    const client = getClient();
    if (!client) {
      return res
        .status(503)
        .json({ error: "Missing GEMINI_API_KEY (or API_KEY) in environment." });
    }

    // Transform to Gemini contents format
    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    // Call model (handle both client styles)
    let resp;
    if (client.models?.generateContent) {
      // Newer style
      resp = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents,
      });
    } else if (client.getGenerativeModel) {
      const model = client.getGenerativeModel({ model: GEMINI_MODEL });
      resp = await model.generateContent({ contents });
    } else {
      throw new Error("Unsupported Gemini client instance");
    }

    res.json({ result: extractText(resp) });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;

function start(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    if (!API_KEY) {
      console.warn(
        "\n[WARN] No GEMINI_API_KEY or API_KEY set. Add it to a .env file."
      );
    }
    console.log(`Server ready on http://localhost:${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      start(port + 1, attemptsLeft - 1);
    } else {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  });
}

start(BASE_PORT);
