const { spawn, execSync } = require('child_process');
const net = require('net');
const http = require('http');
const https = require('https');
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

function broadcastStopped() {
  const message = `event: stopped\ndata: {}\n\n`;
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

function checkTorRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(9050, '127.0.0.1');
  });
}

function fetchThroughTor(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const req = transport.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname || '/',
        method: 'GET',
        headers: { Host: urlObj.hostname },
        createConnection: () => {
          const socket = new net.Socket();
          socket.connect(9050, '127.0.0.1', () => {
            socket.write(`CONNECT ${urlObj.hostname}:${urlObj.port || 443} HTTP/1.1\r\nHost: ${urlObj.hostname}\r\n\r\n`);
            socket.once('data', () => {
              const tls = require('tls');
              if (urlObj.protocol === 'https:') {
                const tlsSocket = tls.connect({ socket, servername: urlObj.hostname });
                resolve(tlsSocket);
              } else {
                resolve(socket);
              }
            });
          });
          socket.on('error', reject);
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Tor request timeout')); });
    req.end();
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
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 3000);
    });
    socket.on('error', (err) => {
      socket.destroy();
      reject(err);
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Tor control port timeout'));
    });
    socket.connect(9051, '127.0.0.1');
  });
}

async function getNewIp() {
  try {
    const ip = await fetchThroughTor('https://api.ipify.org');
    const ipStr = ip.toString().trim();
    let country = 'Unknown';
    let city = 'Unknown';
    try {
      const locData = await fetchThroughTor(`http://ip-api.com/json/${ipStr}`);
      const loc = JSON.parse(locData.toString());
      if (loc.status === 'success') {
        country = loc.country;
        city = loc.city;
      }
    } catch (_) {}
    return { ip: ipStr, country, city };
  } catch (err) {
    throw new Error(`Failed to get IP through Tor: ${err.message}`);
  }
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

async function installTorIfNeeded() {
  try {
    execSync('which tor', { stdio: 'ignore' });
    return;
  } catch (_) {}
  try {
    execSync('apt-get update -qq && apt-get install -y -qq tor', { stdio: 'pipe', timeout: 120000 });
  } catch (_) {
    throw new Error('Failed to install Tor. Install manually: apt install tor');
  }
}

async function ensureTorConfigured() {
  try {
    execSync('grep -q "ControlPort 9051" /etc/tor/torrc 2>/dev/null || echo "ControlPort 9051" >> /etc/tor/torrc', { stdio: 'pipe' });
    execSync('grep -q "CookieAuthentication 0" /etc/tor/torrc 2>/dev/null || echo "CookieAuthentication 0" >> /etc/tor/torrc', { stdio: 'pipe' });
    execSync('pkill -HUP tor 2>/dev/null || systemctl restart tor 2>/dev/null || true', { stdio: 'pipe' });
  } catch (_) {}
}

exports.start = async (req, res) => {
  try {
    if (STATE.running) {
      return res.json({ status: 'already_running', currentIp: STATE.currentIp, country: STATE.country, city: STATE.city });
    }

    const settings = await IpChangerSettings.findOne({ userId: req.user.id });
    STATE.interval = settings?.intervalSeconds || 30;

    await installTorIfNeeded();
    await ensureTorConfigured();

    const torRunning = await checkTorRunning();
    if (!torRunning) {
      try {
        execSync('systemctl start tor 2>/dev/null || tor --runasdaemon 1 2>/dev/null &', { stdio: 'pipe' });
        await new Promise((r) => setTimeout(r, 3000));
      } catch (_) {}
      const stillRunning = await checkTorRunning();
      if (!stillRunning) {
        return res.status(500).json({ message: 'Failed to start Tor. Install it manually: apt install tor' });
      }
    }

    STATE.running = true;
    STATE.startedAt = new Date();
    STATE.error = null;

    try {
      await sendNewnym();
      const { ip, country, city } = await getNewIp();
      STATE.currentIp = ip;
      STATE.country = country;
      STATE.city = city;
      STATE.lastChanged = new Date();
      broadcastSSE({ ip, country, city, timestamp: STATE.lastChanged.toISOString(), type: 'ip-changed' });
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
  if (STATE.timer) {
    clearTimeout(STATE.timer);
    STATE.timer = null;
  }
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
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
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
  const settings = await IpChangerSettings.findOneAndUpdate(
    { userId: req.user.id },
    { userId: req.user.id, intervalSeconds, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  if (STATE.running) {
    STATE.interval = intervalSeconds;
  }
  res.json({ saved: true, intervalSeconds: settings.intervalSeconds });
};

exports.isRunning = () => STATE.running;
exports.getState = () => ({ ...STATE });
