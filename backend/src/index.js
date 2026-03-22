require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const rateLimit = require('express-rate-limit');

const { testConnection } = require('./db');
const { initWebSocket, broadcast } = require('./services/websocket');
const { initSimulator, tick } = require('./services/simulator');
const vehiclesRouter = require('./routes/vehicles');
const { alertsRouter, geofencesRouter, driversRouter, analyticsRouter, authRouter } = require('./routes/index');

const app = express();
const server = http.createServer(app);

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/vehicles',  vehiclesRouter);
app.use('/api/alerts',    alertsRouter);
app.use('/api/geofences', geofencesRouter);
app.use('/api/drivers',   driversRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404
app.use((req, res) => res.status(404).json({ error: `Route ${req.path} not found` }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001');

async function start() {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('Database connection failed. Check your .env settings.');
    process.exit(1);
  }

  // WebSocket
  initWebSocket(server);

  // Vehicle simulator
  if (process.env.SIMULATE_VEHICLES === 'true') {
    await initSimulator();
    const interval = parseInt(process.env.SIMULATION_INTERVAL_MS || '3000');
    setInterval(() => tick(broadcast), interval);
    console.log(`✓ Vehicle simulator running (${interval}ms interval)`);
  }

  server.listen(PORT, () => {
    console.log(`\n🚛 CloudNext Fleet API running on http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start();
