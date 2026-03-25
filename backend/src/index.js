// backend/src/index.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// ✅ Correct import (local file)
import transporter from './config/email.js';

const app = express();

app.use(cors());
app.use(express.json());

// Your request access route
app.post('/api/request-access', async (req, res) => {
  const { name, company, email, phone, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const mailOptions = {
      from: '"CloudNext Fleet" <info@cloudnext.solutions>',
      replyTo: email,
      to: 'shahbaz.atta@gmail.com',
      subject: `Fleet Management Access Request - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>New Access Request</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Message:</strong></p>
          <p style="background:#f8f9fa; padding:15px; border-left:4px solid #00d4e8;">
            ${message || '—'}
          </p>
          <hr>
          <p style="color:#666; font-size:12px;">
            This request was sent from the CloudNext Fleet Management login page.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Request sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});