// backend/src/config/email.js
import nodemailer from 'nodemailer';
import 'dotenv/config';

console.log('Loading Hostinger SMTP...');
console.log('SMTP_USER:', process.env.SMTP_USER ? '✅ Loaded' : '❌ Missing');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,                    // true for SSL (port 465)
  auth: {
    user: process.env.SMTP_USER,   // Your full Hostinger email address
    pass: process.env.SMTP_PASS,   // Your email account password
  },
  // Extra options that often help with Hostinger
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  debug: true,                     // Shows detailed logs (remove later)
  logger: true
});

export default transporter;