const net = require('net');
const http = require('http');
const https = require('https');
const { SocksClient } = require('socks');
const IpChangerSettings = require('../models/IpChangerSettings');

const STATE = {
  running: false,
  currentIp: null,
  country: null,
  city: null,
  lastChanged: null,
  startedAt: null,
  interval: 30,
  timer: null,
  error: null
};

const sseClients = [];

function broadcastSSE(data) {
  const message = `event: ip-changed\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(message);
    } catch (_) {
      sseClients.splice(i, 1);
    }
  }
}

function broadcastError(msg) {
  const message = `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(message);
    } catch (_) {
      sseClients.splice(i, 1);
    }
  }
}

function broadcastStopped() {
  const message = 'event: stopped\ndata: {}\n\n';
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(message);
    } catch (_) {
      sseClients.splice(i, 1);
    }
  }
}

function checkTorRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(9050, '127.0.0.1');
  });
}

async function fetchThroughTor(url) {
  const urlObj = new URL(url);
  const port = urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);

  const { socket } = await SocksClient.createConnection({
    proxy: { host: '127.0.0.1', port: 9050, type: 5 },
    command: 'connect',
    destination: { host: urlObj.hostname, port }
  });

  if (urlObj.protocol === 'https:') {
    const tls = require('tls');
    const tlsSocket = tls.connect({ socket, servername: urlObj.hostname });
    return new Promise((resolve, reject) => {
      let data = '';
      tlsSocket.setTimeout(15000);
      tlsSocket.on('data', (chunk) => { data += chunk; });
      tlsSocket.on('end', () => resolve(data));
      tlsSocket.on('error', (err) => { tlsSocket.destroy(); reject(err); });
      tlsSocket.on('timeout', () => { tlsSocket.destroy(); reject(new Error('Tor request timeout')); });
      const path = urlObj.pathname || '/';
      tlsSocket.write(`GET ${path} HTTP/1.1\r\nHost: ${urlObj.hostname}\r\nConnection: close\r\n\r\n`);
    });
  }

  return new Promise((resolve, reject) => {
    let data = '';
    socket.setTimeout(15000);
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('end', () => resolve(data));
    socket.on('error', (err) => { socket.destroy(); reject(err); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Tor request timeout')); });
    const path = urlObj.pathname || '/';
    socket.write(`GET ${path} HTTP/1.1\r\nHost: ${urlObj.hostname}\r\nConnection: close\r\n\r\n`);
  });
}

function sendNewnym() {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on('connect', () => {
      socket.write('AUTHENTICATE ""\r\n');
      socket.write('SIGNAL NEWNYM\r\n');
      socket.write('QUIT\r\n');
      setTimeout(() => { socket.destroy(); resolve(); }, 3000);
    });
    socket.on('error', (err) => { socket.destroy(); reject(err); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Tor control port timeout')); });
    socket.connect(9051, '127.0.0.1');
  });
}

async function getNewIp() {
  const ip = await fetchThroughTor('https://api.ipify.org');
  const ipStr = ip.toString().trim();
  const loc = await fetchThroughTor(`http://ip-api.com/json/${ipStr}`);
  const data = JSON.parse(loc.toString());
  return {
    ip: ipStr,
    country: data.status === 'success' ? data.country : 'Unknown',
    city: data.status === 'success' ? data.city : 'Unknown'
  };
}

async function rotationLoop() {
  if (!STATE.running) return;
  try {
    await sendNewnym();
    const { ip, country, city } = await getNewIp();
    STATE.currentIp = ip;
    STATE.country = country;
    STATE.city = city;
    STATE.lastChanged = new Date();
    STATE.error = null;
    broadcastSSE({ ip, country, city, timestamp: STATE.lastChanged.toISOString(), type: 'ip-changed' });
  } catch (err) {
    STATE.error = err.message;
    broadcastError(err.message);
  }
  if (STATE.running) {
    STATE.timer = setTimeout(rotationLoop, STATE.interval * 1000);
  }
}

exports.start = async (req, res) => {
  try {
    if (STATE.running) {
      return res.json({ status: 'already_running', currentIp: STATE.currentIp, country: STATE.country, city: STATE.city });
    }

    const settings = await IpChangerSettings.findOne({ userId: req.user.id });
    STATE.interval = settings?.intervalSeconds || 30;

    const torRunning = await checkTorRunning();
    if (!torRunning) {
      return res.status(500).json({ message: 'Tor is not running. Start it: sudo systemctl start tor' });
    }

    STATE.running = true;
    STATE.startedAt = new Date();
    STATE.error = null;

    try {
      await sendNewnym();
      const ipInfo = await getNewIp();
      STATE.currentIp = ipInfo.ip;
      STATE.country = ipInfo.country;
      STATE.city = ipInfo.city;
      STATE.lastChanged = new Date();
      broadcastSSE({ ...ipInfo, timestamp: STATE.lastChanged.toISOString(), type: 'ip-changed' });
    } catch (firstIpErr) {
      STATE.currentIp = 'unknown';
      STATE.country = null;
      STATE.city = null;
    }

    STATE.timer = setTimeout(rotationLoop, STATE.interval * 1000);

    res.json({ status: 'started', currentIp: STATE.currentIp, country: STATE.country, city: STATE.city, interval: STATE.interval });
  } catch (err) {
    STATE.running = false;
    res.status(500).json({ message: err.message });
  }
};

exports.stop = async (req, res) => {
  if (STATE.timer) { clearTimeout(STATE.timer); STATE.timer = null; }
  STATE.running = false;
  STATE.currentIp = null;
  STATE.country = null;
  STATE.city = null;
  STATE.lastChanged = null;
  STATE.startedAt = null;
  broadcastStopped();
  res.json({ status: 'stopped' });
};

exports.status = async (req, res) => {
  const uptime = STATE.startedAt ? Math.floor((Date.now() - STATE.startedAt.getTime()) / 1000) : 0;
  const nextChangeIn = STATE.running && STATE.lastChanged
    ? Math.max(0, STATE.interval - Math.floor((Date.now() - STATE.lastChanged.getTime()) / 1000))
    : 0;
  res.json({
    running: STATE.running,
    currentIp: STATE.currentIp,
    country: STATE.country,
    city: STATE.city,
    interval: STATE.interval,
    uptime,
    nextChangeIn,
    error: STATE.error,
    startedAt: STATE.startedAt
  });
};

exports.sseEvents = async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Alt-Svc': 'clear'
  });
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
};

exports.getSettings = async (req, res) => {
  const settings = await IpChangerSettings.findOne({ userId: req.user.id });
  res.json({ intervalSeconds: settings?.intervalSeconds || 30 });
};

exports.updateSettings = async (req, res) => {
  const { intervalSeconds } = req.body;
  if (!intervalSeconds || intervalSeconds < 10 || intervalSeconds > 300) {
    return res.status(400).json({ message: 'Interval must be between 10 and 300 seconds' });
  }
  await IpChangerSettings.findOneAndUpdate(
    { userId: req.user.id },
    { userId: req.user.id, intervalSeconds, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  if (STATE.running) STATE.interval = intervalSeconds;
  res.json({ saved: true, intervalSeconds });
};

exports.isRunning = () => STATE.running;
exports.getState = () => ({ ...STATE });
