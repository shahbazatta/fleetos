require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('✓ Migrations complete');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
