const WebSocket = require('ws');

let wss = null;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`WebSocket client connected (${clients.size} total)`);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleMessage(ws, msg);
      } catch (_) {}
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (err) => {
      console.error('WS error:', err.message);
      clients.delete(ws);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: 'connected', message: 'FleetOS WebSocket ready' }));
  });

  return wss;
}

function handleMessage(ws, msg) {
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
  }
  if (msg.type === 'subscribe_vehicle') {
    ws._subscribedVehicle = msg.vehicleId;
  }
}

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch (_) {}
    }
  }
}

function broadcastToVehicleSubscribers(vehicleId, data) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client._subscribedVehicle === vehicleId) {
      try { client.send(payload); } catch (_) {}
    }
  }
}

module.exports = { initWebSocket, broadcast, broadcastToVehicleSubscribers };
