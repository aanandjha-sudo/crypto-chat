import {initializeApp, getApps, getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: 'cryptochat-m3139',
  appId: '1:586118431071:web:28c9ab922ea52ee774f6ea',
  storageBucket: 'cryptochat-m3139.appspot.com',
  apiKey: 'AIzaSyDJQhK9oElNs8ng6LeMRj5BuB226hrMspU',
  authDomain: 'cryptochat-m3139.firebaseapp.com',
  messagingSenderId: '586118431071',
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {app, auth, db, storage};
