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
const usersRouter    = require('./routes/users');
const tenantsRouter  = require('./routes/tenants');
const { alertsRouter, geofencesRouter, driversRouter, analyticsRouter, authRouter } = require('./routes/index');

const app = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', rateLimit({ windowMs: 60_000, max: process.env.NODE_ENV === 'production' ? 300 : 3000, standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth',      authRouter);
app.use('/api/users',     usersRouter);
app.use('/api/tenants',   tenantsRouter);
app.use('/api/vehicles',  vehiclesRouter);
app.use('/api/alerts',    alertsRouter);
app.use('/api/geofences', geofencesRouter);
app.use('/api/drivers',   driversRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/fm',        require('./routes/fleetManagement'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: `Route ${req.path} not found` }));
app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ error: err.message }); });

const PORT = parseInt(process.env.PORT || '3001');

async function tryDbConnect(retries = 5, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    console.log(`DB connection attempt ${i}/${retries}...`);
    const ok = await testConnection();
    if (ok) return true;
    if (i < retries) { console.log(`  Retrying in ${delayMs/1000}s...`); await new Promise(r => setTimeout(r, delayMs)); }
  }
  return false;
}

async function start() {
  const dbOk = await tryDbConnect();
  if (!dbOk) {
    console.error('\n⚠️  Starting without database — fix .env and restart\n');
  } else {
    initWebSocket(server);
    if (process.env.SIMULATE_VEHICLES !== 'false') {
      try {
        await initSimulator();
        const interval = parseInt(process.env.SIMULATION_INTERVAL_MS || '3000');
        setInterval(() => tick(broadcast), interval);
        console.log(`✓ Vehicle simulator running (${interval}ms interval)`);
      } catch (simErr) {
        console.error('Simulator init failed:', simErr.message);
      }
    }
  }
  server.listen(PORT, () => {
    console.log(`\n🚛 CloudNext Fleet API  →  http://localhost:${PORT}`);
    console.log(`   Tenants API          →  http://localhost:${PORT}/api/tenants`);
    console.log(`   Users API            →  http://localhost:${PORT}/api/users\n`);
  });
}

start();
