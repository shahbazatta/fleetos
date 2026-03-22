const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'fleet_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

// Helper: tagged template query
const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
const getClient = () => pool.connect();

// Test connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT PostGIS_Version()');
    console.log(`✓ PostgreSQL+PostGIS connected — ${res.rows[0].postgis_version}`);
    client.release();
    return true;
  } catch (err) {
    console.error('✗ DB connection failed:', err.message);
    return false;
  }
};

module.exports = { pool, query, getClient, testConnection };
