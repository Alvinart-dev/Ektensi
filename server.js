/**
 * Dola AI Assistant — Backend (Railway)
 * Endpoint:
 *   GET  /api/health
 *   POST /api/chat
 */

import express from "express";
import cors from "cors";
import { dolaChat } from "./dola.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: true,
    service: "dola-ai-backend",
    timestamp: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({
      status: false,
      error: "Prompt wajib diisi dan berupa string."
    });
  }

  try {
    const result = await dolaChat(prompt.trim(), {
      headless: "new",
      timeout: 40000,
      streamTimeout: 60000,
      blockResources: true
    });

    if (!result || result.status !== true) {
      return res.status(502).json({
        status: false,
        error: result?.error || "Scraper Dola AI gagal memberikan jawaban."
      });
    }

    return res.json({
      status: true,
      prompt: prompt.trim(),
      result: result.result
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      error: err.message || "Terjadi kesalahan pada server."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ status: false, error: "Endpoint tidak ditemukan." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan pada port ${PORT}`);
});