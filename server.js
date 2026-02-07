// server.js
// Minimal Express server that serves static files from ./public
// and exposes POST /api/chat for LLM calls using OpenAI (server-side).
// Install: npm install express cors openai dotenv

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { OpenAI } = require('openai'); // official SDK
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if(!OPENAI_KEY){
  console.warn('WARNING: OPENAI_API_KEY not set. /api/chat will return errors.');
}

const client = new OpenAI({ apiKey: OPENAI_KEY });

const app = express();
app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if(!prompt || typeof prompt !== 'string' || prompt.trim().length === 0){
      return res.status(400).json({ error: 'Missing prompt' });
    }
    if(!OPENAI_KEY) {
      return res.status(500).json({ error: 'Server not configured with OPENAI_API_KEY' });
    }

    // Use a chat/completion call. Model choice may change — use a reasonable one available to you.
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // change as needed

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7
    });

    // attempt to extract text
    const reply = response?.choices?.[0]?.message?.content || (response?.choices?.[0]?.text) || 'No reply';
    return res.json({ reply });
  } catch (err) {
    console.error('LLM error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// fallback to index.html for SPA routes
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on http://localhost:'+PORT));
