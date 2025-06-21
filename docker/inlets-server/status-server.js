#!/usr/bin/env node
// Simple status server for Inlets OSS
// This provides a status API endpoint that the backend can query

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.STATUS_PORT || 8091;
const TUNNELS_FILE = '/data/tunnels.json';

// Initialize tunnels file
if (!fs.existsSync(TUNNELS_FILE)) {
  fs.writeFileSync(TUNNELS_FILE, JSON.stringify([], null, 2));
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Status endpoint
  if (url.pathname === '/status' && req.method === 'GET') {
    try {
      const tunnels = JSON.parse(fs.readFileSync(TUNNELS_FILE, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tunnels));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read tunnels' }));
    }
    return;
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Register tunnel (called by inlets client wrapper)
  if (url.pathname === '/tunnels' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const tunnel = JSON.parse(body);
        const tunnels = JSON.parse(fs.readFileSync(TUNNELS_FILE, 'utf8'));
        
        // Add or update tunnel
        const index = tunnels.findIndex(t => t.client_id === tunnel.client_id && t.upstream === tunnel.upstream);
        if (index >= 0) {
          tunnels[index] = { ...tunnel, updated_at: new Date().toISOString() };
        } else {
          tunnels.push({ ...tunnel, connected_at: new Date().toISOString() });
        }
        
        fs.writeFileSync(TUNNELS_FILE, JSON.stringify(tunnels, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // Remove tunnel
  if (url.pathname.startsWith('/tunnels/') && req.method === 'DELETE') {
    const clientId = decodeURIComponent(url.pathname.split('/')[2]);
    try {
      let tunnels = JSON.parse(fs.readFileSync(TUNNELS_FILE, 'utf8'));
      tunnels = tunnels.filter(t => t.client_id !== clientId);
      fs.writeFileSync(TUNNELS_FILE, JSON.stringify(tunnels, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to remove tunnel' }));
    }
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  console.log(`Status server listening on port ${PORT}`);
});

// Cleanup old tunnels every minute
setInterval(() => {
  try {
    const tunnels = JSON.parse(fs.readFileSync(TUNNELS_FILE, 'utf8'));
    const now = Date.now();
    const activeTunnels = tunnels.filter(t => {
      const lastUpdate = new Date(t.updated_at || t.connected_at).getTime();
      return now - lastUpdate < 60000; // Keep tunnels updated within last minute
    });
    if (activeTunnels.length !== tunnels.length) {
      fs.writeFileSync(TUNNELS_FILE, JSON.stringify(activeTunnels, null, 2));
      console.log(`Cleaned up ${tunnels.length - activeTunnels.length} inactive tunnels`);
    }
  } catch (err) {
    console.error('Failed to cleanup tunnels:', err);
  }
}, 60000);