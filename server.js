const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const SYMBOLS = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD', 'XAG/USD'];
const API_KEY = process.env.TWELVE_DATA_API_KEY || '';

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'wahyudifx-market-stream', mode: 'read-only-education' }));
    return;
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const clients = new Set();
const latestPrices = new Map();
let upstream = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let upstreamState = 'idle';

function sendJson(client, payload) {
  if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
}
function broadcast(payload) {
  const encoded = JSON.stringify(payload);
  for (const client of clients) if (client.readyState === WebSocket.OPEN) client.send(encoded);
}
function closeUpstream() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  heartbeatTimer = null;
  reconnectTimer = null;
  if (upstream) {
    const old = upstream;
    upstream = null;
    if (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING) old.close();
  }
}
function scheduleReconnect() {
  if (!clients.size || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectUpstream();
  }, 5000);
}
function connectUpstream() {
  if (upstream || !clients.size) return;

  if (process.env.TWELVE_DATA_PUBLIC_DISPLAY_APPROVED !== 'true' || !API_KEY) {
    const message = process.env.TWELVE_DATA_PUBLIC_DISPLAY_APPROVED !== 'true'
      ? 'Stream publik dikunci sampai hak display/redistribusi Twelve Data dikonfirmasi.'
      : 'API key belum dipasang sebagai environment secret di server.';
    broadcast({ event: 'status', status: 'disabled', retryable: false, message });
    return;
  }

  upstreamState = 'connecting';
  broadcast({ event: 'status', status: 'connecting' });
  const url = 'wss://ws.twelvedata.com/v1/quotes/price?apikey=' + encodeURIComponent(API_KEY);
  const socket = new WebSocket(url);
  upstream = socket;

  socket.on('open', () => {
    if (upstream !== socket) return;
    upstreamState = 'connected';
    socket.send(JSON.stringify({ action: 'subscribe', params: { symbols: SYMBOLS.join(',') } }));
    heartbeatTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'heartbeat' }));
    }, 10000);
    broadcast({ event: 'status', status: 'connected', source: 'Twelve Data' });
  });
  socket.on('message', (raw) => {
    if (upstream !== socket) return;
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) { return; }
    if (message.event === 'price' && SYMBOLS.includes(message.symbol)) latestPrices.set(message.symbol, message);
    broadcast(message);
  });
  socket.on('error', () => broadcast({ event: 'status', status: 'error', message: 'Koneksi upstream Twelve Data gagal.' }));
  socket.on('close', () => {
    if (upstream !== socket) return;
    upstream = null;
    upstreamState = 'disconnected';
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    broadcast({ event: 'status', status: 'error', message: 'Stream upstream terputus; mencoba sambung kembali.' });
    scheduleReconnect();
  });
}

const browserWss = new WebSocket.Server({ noServer: true, maxPayload: 1024 });
httpServer.on('upgrade', (req, socket, head) => {
  if (req.url !== '/market-stream') return socket.destroy();
  browserWss.handleUpgrade(req, socket, head, (client) => browserWss.emit('connection', client, req));
});
browserWss.on('connection', (client) => {
  clients.add(client);
  sendJson(client, { event: 'status', status: upstreamState === 'connected' ? 'connected' : 'connecting' });
  for (const price of latestPrices.values()) sendJson(client, price);
  if (!upstream && !reconnectTimer) connectUpstream();

  client.on('message', (raw) => {
    // Browser clients cannot choose symbols or submit orders; heartbeat only.
    try {
      const message = JSON.parse(raw.toString());
      if (message.action === 'heartbeat') sendJson(client, { event: 'status', status: 'connected' });
    } catch (_) {}
  });
  client.on('close', () => {
    clients.delete(client);
    if (!clients.size) closeUpstream();
  });
});

httpServer.listen(PORT, HOST, () => console.log('WahyudiFX read-only market stream listening on ' + PORT));
