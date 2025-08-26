import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

let adminApp: App;

if (getApps().length === 0) {
    adminApp = initializeApp({
        credential: credential.applicationDefault(),
    });
} else {
    adminApp = getApp();
}

export { adminApp };
