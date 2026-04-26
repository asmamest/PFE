const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8081;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const API_URL = 'http://localhost:8083';

// Routes API proxy
app.post('/api/keys/generate', async (req, res) => {
    const response = await fetch(`${API_URL}/keys/generate`, { method: 'POST' });
    const data = await response.json();
    res.json(data);
});

app.post('/api/sign', async (req, res) => {
    console.log('📨 POST /api/sign');
    try {
        const response = await fetch(`${API_URL}/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/verify', async (req, res) => {
    const response = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
});

app.post('/api/kem/generate', async (req, res) => {
    const response = await fetch(`${API_URL}/kem/generate`, { method: 'POST' });
    const data = await response.json();
    res.json(data);
});

app.post('/api/kem/encrypt', async (req, res) => {
    const response = await fetch(`${API_URL}/kem/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
});

app.post('/api/kem/decrypt', async (req, res) => {
    const response = await fetch(`${API_URL}/kem/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
});

app.get('/api/signatures', async (req, res) => {
    const response = await fetch(`${API_URL}/signatures`);
    const data = await response.json();
    res.json(data);
});

app.get('/api/health', async (req, res) => {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`🚀 Proxy sur http://localhost:${PORT}`);
    console.log(`📡 API backend: ${API_URL}`);
});
