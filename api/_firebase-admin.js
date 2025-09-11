import admin from 'firebase-admin';

export function initializeDb() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const decodedServiceAccount = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
  const serviceAccount = JSON.parse(decodedServiceAccount);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return admin.firestore();
}