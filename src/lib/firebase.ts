import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: 'cryptochat-m3139',
  appId: '1:586118431071:web:28c9ab922ea52ee774f6ea',
  storageBucket: 'cryptochat-m3139.firebasestorage.app',
  apiKey: 'AIzaSyDJQhK9oElNs8ng6LeMRj5BuB226hrMspU',
  authDomain: 'cryptochat-m3139.firebaseapp.com',
  messagingSenderId: '586118431071',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {db};
