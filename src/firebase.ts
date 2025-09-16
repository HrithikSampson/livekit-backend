// @/utils/firebase.ts
import type { ServiceAccount } from 'firebase-admin';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      // Falls back to ADC if running on GCP with Workload Identity
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
      });
    } else {
      let serviceAccount = JSON.parse(raw) as ServiceAccount & { private_key?: string };
      if (serviceAccount.private_key?.includes('\\n')) {
        serviceAccount = { ...serviceAccount, private_key: serviceAccount.private_key.replace(/\\n/g, '\n') };
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
      });
    }

    // eslint-disable-next-line no-console
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Firebase admin initialization error', error);
  }
}

const db = admin.firestore();
export { db };
