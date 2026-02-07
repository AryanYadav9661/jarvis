# Jarvis-LLM (local)

## Quick start

1. Copy files and folders (public/ containing index.html, styles.css, script.js).
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and put your `OPENAI_API_KEY`.
4. Start server:
   ```
   npm start
   ```
5. Open `http://localhost:3000` in Chrome and test.

## Notes
- Do NOT store API keys in client-side JS.
- This demo uses OpenAI's official SDK. Change `server.js` if you use another provider.
