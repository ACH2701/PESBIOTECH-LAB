import { Resend } from 'resend';
import bcrypt from 'bcryptjs';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeDb } from './_firebase-admin.js'; // <-- FIX: Added .js extension

const resend = new Resend(process.env.RESEND_API_KEY);

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const db = await initializeDb();
    const otpRef = db.collection('otp_verifications').doc(email);
    await otpRef.set({
      otpHash: hashedOtp,
     expires: Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000)),
    });

    await resend.emails.send({
      from: 'PESU Biotech Labs <onboarding@resend.dev>',
      to: email,
      subject: 'Your Login Code for PESU Biotech Labs',
      html: `<p>Your one-time login code is: <strong>${otp}</strong></p><p>This code will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP email.' });
  }
};
