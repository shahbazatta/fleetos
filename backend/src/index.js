// backend/src/index.js
require('dotenv').config();

const http        = require('http');
const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const morgan      = require('morgan');

const { alertsRouter, geofencesRouter, driversRouter, analyticsRouter, authRouter } = require('./routes/index');
const vehiclesRouter    = require('./routes/vehicles');
const fmRouter          = require('./routes/fleetManagement');
const mobileRouter      = require('./routes/mobile');
const usersRouter       = require('./routes/users');
const tenantsRouter     = require('./routes/tenants');
const { initWebSocket, broadcast } = require('./services/websocket');

const { startSimulator } = require('./services/simulator');

const transporter = require('./config/email');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
// fleet.cloudnext.solutions UNCOMMENT WHILE DEPLOY TO WEBSITE
// app.use(cors({
//   origin: [
//     'https://fleet.cloudnext.solutions',
//     'http://localhost:5173',
//     'http://localhost:3000',
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/alerts',    alertsRouter);
app.use('/api/geofences', geofencesRouter);
app.use('/api/drivers',   driversRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/vehicles',  vehiclesRouter);
app.use('/api/fm',        fmRouter);
app.use('/api/mobile',    mobileRouter);
app.use('/api/users',     usersRouter);
app.use('/api/tenants',   tenantsRouter);

// ── Request-Access Endpoint ────────────────────────────────────────────────────
app.post('/api/request-access', async (req, res) => {
  const { name, company, email, phone, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    await transporter.sendMail({
      from: `"FirstCity AI Fleet" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: 'info@cloudnext.solutions',
      subject: `Fleet Management Access Request — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h2 style="color:#00d4e8">New Platform Access Request</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Company:</strong> ${company || '—'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || '—'}</p>
          <p><strong>Message:</strong></p>
          <p style="background:#f8f9fa;padding:15px;border-left:4px solid #00d4e8">${message || '—'}</p>
          <hr>
          <p style="color:#666;font-size:12px">Sent from the FirstCity AI Fleet Management login page.</p>
        </div>
      `,
    });
    res.json({ success: true, message: 'Request sent successfully' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// WebSocket + Simulator
initWebSocket(server);

if (process.env.SIMULATE_VEHICLES === 'true') {
  if (typeof startSimulator === 'function') {
    startSimulator();
    startSimulator.setBroadcast(broadcast); // wire WebSocket → simulator
  } else {
    console.warn('⚠️  startSimulator is not a function. Simulator will not start.');
  }
}

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Fleet backend running on http://localhost:${PORT}`);
});