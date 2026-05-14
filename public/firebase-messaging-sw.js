importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "TU_API_KEY",
    projectId: "tu-proyecto-id",
    messagingSenderId: "tu-sender-id",
    appId: "com.citygo"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Mensaje en segundo plano recibido:', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/assets/logo_fondo.png'
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
});