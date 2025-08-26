// This file must be in the public folder.
// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase SDKs before v9.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// You MUST EDIT THIS with your project's details.
firebase.initializeApp({
  projectId: 'cryptochat-m3139',
  appId: '1:586118431071:web:28c9ab922ea52ee774f6ea',
  storageBucket: 'cryptochat-m3139.firebasestorage.app',
  apiKey: 'AIzaSyDJQhK9oElNs8ng6LeMRj5BuB226hrMspU',
  authDomain: 'cryptochat-m3139.firebaseapp.com',
  messagingSenderId: '586118431071',
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png' // You can add a default icon here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
