// @/utils/firebase.ts
import type { ServiceAccount } from 'firebase-admin';
import admin from 'firebase-admin';

// Path to your service account key file
// Adjust this path as needed based on where you store your key file
// eslint-disable-next-line prettier/prettier
import serviceAccount from '../serviceAccountKey.json' assert { type: 'json' };

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase admin initialization error', error);
    console.error('Make sure serviceAccountKey.json is in the correct location');
  }
}

const db = admin.firestore();

export { db };