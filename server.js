// server.js  — Gemini (Generative Language) proxy
// Minimal Express server that serves ./public and proxies POST /api/chat to Gemini REST.
// Requires Node 18+ (for global fetch).
// npm install express cors dotenv

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// env vars
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'; // change if you prefer
const PORT = process.env.PORT || 3000;

if(!GEMINI_API_KEY){
  console.warn('WARNING: GEMINI_API_KEY not set. /api/chat will return errors.');
}

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

/**
 * POST /api/chat
 * Body: { prompt: string }
 * Returns: { reply: string } (or error)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Server not configured with GEMINI_API_KEY' });
    }

    // Build Gemini REST URL (Generative Language API)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

    // Body shape according to docs: contents -> parts -> text
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      // optional: you can add temperature, candidate_count, safety_settings, etc.
      // Example:
      // temperature: 0.7
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Quickstart shows x-goog-api-key header for API-key auth.
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Gemini API error', resp.status, txt);
      return res.status(502).json({ error: 'Gemini API error', detail: txt, status: resp.status });
    }

    const j = await resp.json();

    // Try to robustly extract text from the response structure.
    // REST responses often have: candidates[0].content.parts[0].text
    let reply = 'No reply from Gemini';
    try {
      reply = j?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text
           || j?.candidates?.[0]?.content?.parts?.[0]?.text
           || j?.candidates?.[0]?.content?.parts?.[0]?.text
           || j?.candidates?.[0]?.content?.[0]?.text
           || JSON.stringify(j);
    } catch (e) {
      reply = JSON.stringify(j);
    }

    return res.json({ reply });
  } catch (err) {
    console.error('Server /api/chat error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
