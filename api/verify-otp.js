import bcrypt from 'bcryptjs';
import { initializeDb } from './_firebase-admin';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  try {
    const db = await initializeDb();
    const otpRef = db.collection('otp_verifications').doc(email);
    const doc = await otpRef.get();

    if (!doc.exists) {
      return res.status(400).json({ error: 'Invalid OTP or it has expired.' });
    }

    const { otpHash, expires } = doc.data();

    if (new Date() > expires.toDate()) {
      await otpRef.delete();
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    const isValid = await bcrypt.compare(otp, otpHash);
    
    await otpRef.delete();

    if (isValid) {
      res.status(200).json({ success: true, message: 'OTP verified successfully.' });
    } else {
      res.status(400).json({ error: 'Invalid OTP.' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ error: 'Failed to verify OTP.' });
  }
};