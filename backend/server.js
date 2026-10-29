const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve frontend static files from ../frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// In-memory chat history (array of {user, gemini, timestamp}). Keep last 10 exchanges
const chatHistory = [];

function addExchange(userMsg, geminiMsg) {
  chatHistory.push({ user: userMsg, gemini: geminiMsg, timestamp: Date.now() });
  if (chatHistory.length > 10) chatHistory.shift();
}

app.get('/api/history', (req, res) => {
  res.json(chatHistory);
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Invalid question' });
    }

    // Mock/demo mode: if USE_MOCK=true, return a canned response without calling Gemini.
    if (process.env.USE_MOCK === 'true') {
      const mockGenerated = `Common flu symptoms include fever, cough, sore throat, body aches, fatigue, and sometimes nasal congestion or headache. Most people recover within a week to 10 days. (Note: This is not medical advice, just general information.)`;
      addExchange(question, mockGenerated);
      return res.json({ answer: mockGenerated });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Build Gemini request payload
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    const prompt = question;

    // Use the 'input.content' format: an array of content objects (type:text) which some
    // versions of the generateContent endpoint accept.
    const body = {
      input: {
        content: [
          { type: 'text', text: prompt }
        ]
      }
    };

    // Determine auth method: prefer service account (OAuth bearer) if available, otherwise use API key
    let headers = { 'Content-Type': 'application/json' };
    let fetchUrl = endpoint;

    // If GOOGLE_APPLICATION_CREDENTIALS is set or a service-account file exists in backend/service-account.json,
    // use google-auth-library to obtain an access token and pass it in Authorization header.
    const saPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const saPathFallback = path.join(__dirname, 'service-account.json');
    let saAvailable = false;
    if (saPathEnv && fs.existsSync(saPathEnv)) saAvailable = true;
    else if (fs.existsSync(saPathFallback)) {
      // set the env var so google-auth-library will pick it up
      process.env.GOOGLE_APPLICATION_CREDENTIALS = saPathFallback;
      saAvailable = true;
    }

    if (saAvailable) {
      const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      const token = tokenResponse && tokenResponse.token ? tokenResponse.token : tokenResponse;
      if (!token) {
        return res.status(500).json({ error: 'Could not obtain access token from service account' });
      }
      headers['Authorization'] = `Bearer ${token}`;
    } else if (apiKey) {
      // Use API key in query string
      fetchUrl = `${endpoint}?key=${encodeURIComponent(apiKey)}`;
    } else {
      return res.status(500).json({ error: 'Gemini API key not configured on server and no service account found' });
    }

    // Send request
    const r = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('Gemini API error', r.status, text);
      return res.status(502).json({ error: 'Error from Gemini API', details: text });
    }

    const data = await r.json();

    // Parse generated text from Gemini response. Different Gemini versions return different shapes.
    let generated = '';
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
      generated = data.candidates[0].content;
    } else if (data.output && data.output.length > 0 && data.output[0].content) {
      const content = data.output[0].content;
      if (Array.isArray(content)) {
        generated = content.map(c => c.text || c).join(' ');
      } else if (typeof content === 'string') {
        generated = content;
      } else if (content.text) {
        generated = content.text;
      }
    } else if (data.text) {
      generated = data.text;
    } else if (data.result && data.result.output && data.result.output[0] && data.result.output[0].content) {
      generated = data.result.output[0].content[0].text || '';
    } else {
      generated = JSON.stringify(data);
    }

    generated = String(generated || '').trim();

    const finalAnswer = generated + ' (Note: This is not medical advice, just general information.)';

    addExchange(question, finalAnswer);

    res.json({ answer: finalAnswer });
  } catch (err) {
    console.error('Server error in /api/ask', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Ask Doctor Gemini listening on http://localhost:${PORT}`);
});
