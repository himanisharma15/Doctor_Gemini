# Ask Doctor Gemini 🩺

This project contains a frontend and backend for a demo AI health Q&A using the Gemini API.

Structure
```
ask-doctor-gemini/
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  └─ script.js
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ .env.example
└─ README.md
```

Quick start
1. In `backend/` create a `.env` file with your Gemini API key:

```
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

2. Install backend deps and run the server:

```bash
cd backend
npm install
npm start
```

3. Open http://localhost:3000 in your browser.

Notes
- The frontend is served by the backend's static file server. All Gemini calls happen on the backend.
- Chat history is stored in memory and resets on server restart.
