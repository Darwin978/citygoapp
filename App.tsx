import React, { use, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Importaremos las pantallas que crearemos a continuación
import RegisterScreen from './src/screens/RegisterScreen';
import PendingApprovalScreen from './src/screens/PendingApprovalScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
const Stack = createNativeStackNavigator();
import * as Notifications from 'expo-notifications';
import { Linking, Platform, TouchableOpacity, View, Text, AppState, Alert, PermissionsAndroid } from 'react-native';
import { AndroidNotificationPriority } from 'expo-notifications';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from './utils/context/AuthContext';
import TerminosScreen from './src/components/TerminosCondiciones';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PermissionProvider, usePermissions } from './utils/context/PermissionContext';
import * as SplashScreen from 'expo-splash-screen';
import LoadingScreen from './src/screens/LoadingScreen';
import TabNavigator from './src/navigation/TabNavigator';
import * as Location from 'expo-location';
import messaging from '@react-native-firebase/messaging';
import { saveTokenInBackend } from './utils/services/userService';

const RIDE_NOTIFICATION_CHANNEL_ID = 'rides-critical-v2';
const RIDE_DEEPLINK_PREFIX = 'citygo://ride';


Location.startLocationUpdatesAsync("LOCATION_TASK", {
  accuracy: Location.Accuracy.High,
  timeInterval: 15000, // 15 segundos para la DB
  distanceInterval: 20, // o cada 20 metros
  foregroundService: {
    notificationTitle: "CityGo está activo",
    notificationBody: "Tu ubicación se está compartiendo para recibir viajes.",
  },
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Estas son las que te pide el error:
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(RIDE_NOTIFICATION_CHANNEL_ID, {
    name: 'Carreras urgentes',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 800],
    lightColor: '#FF231F7C',
    sound: 'notificacion.mp3', // Sonido personalizado
    bypassDnd: true, // Ayuda a saltar el modo 'No Molestar' si el usuario da permiso
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM, // Frecuentemente suena aunque el celular esté en silencio
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  });
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Notificaciones desactivadas', 'Activa las notificaciones para recibir nuevas carreras.');
      return;
    }
  }

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    alert('¡Debes habilitar las notificaciones para recibir carreras!');
    return;
  }

  try {
    const token = await messaging().getToken();
    console.log('Firebase Cloud Messaging Token:', token);
    await saveTokenInBackend(token);
  } catch (error) {
    console.log('Error getting FCM token:', error);
  }
}

async function openRideFromNotification(remoteMessage?: any) {
  const rideId = remoteMessage?.data?.rideId;
  if (!rideId) {
    Linking.openURL('citygo://').catch(err => console.log('Error abriendo app', err));
    return;
  }

  await AsyncStorage.setItem('activeRideId', String(rideId));
  Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() => {
    Linking.openURL('citygo://').catch(err => console.log('Error abriendo app', err));
  });
}

async function showForegroundRideNotification(remoteMessage: any) {
  const title = remoteMessage?.notification?.title || remoteMessage?.data?.title || 'Nueva solicitud de viaje';
  const body = remoteMessage?.notification?.body || remoteMessage?.data?.body || 'Tienes una carrera disponible.';

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'notificacion.mp3',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        ...remoteMessage?.data,
        rideId: remoteMessage?.data?.rideId,
      },
    },
    trigger: Platform.OS === 'android' ? { channelId: RIDE_NOTIFICATION_CHANNEL_ID } as any : null,
  });
}

export function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Pending" component={PendingApprovalScreen} />
      <Stack.Screen name="Map" component={HomeScreen} />
    </Stack.Navigator>
  );
}

function WithoutLogin() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Pending" component={PendingApprovalScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, isApproved } = useAuth();
  const { termsAccepted, requestPermissions, locationGranted, requestOverlayPermission } = usePermissions();

  const [showSplash, setShowSplash] = useState(true);
  const [permissionsSettled, setPermissionsSettled] = useState(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.log(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  useEffect(() => {
    const splashTimeout = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(splashTimeout);
  }, []);


  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Nueva carrera recibida (Foreground):', remoteMessage);
      await showForegroundRideNotification(remoteMessage);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const initPermissions = async () => {
      setPermissionsSettled(false);
      await requestPermissions();
      if (isLoggedIn) {
        await registerForPushNotificationsAsync();
        await requestOverlayPermission();
      }
      setPermissionsSettled(true);
    };
    initPermissions();

    if (isLoggedIn) {

      // Actualizar token cada vez que la app vuelve al primer plano
      const appStateSubscription = AppState.addEventListener('change', nextAppState => {
        if (nextAppState === 'active') {
          console.log('App ha vuelto al primer plano. Verificando token FCM...');
          registerForPushNotificationsAsync();
        }
      });

      // Escuchar también cuando Firebase decida refrescar el token internamente
      const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
        console.log('El token FCM se ha refrescado automáticamente:', token);
        await saveTokenInBackend(token);
      });

      const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(openRideFromNotification);

      messaging().getInitialNotification().then(openRideFromNotification);

      const notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const rideId = response.notification.request.content.data?.rideId;
        if (rideId) {
          AsyncStorage.setItem('activeRideId', String(rideId));
          Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() => Linking.openURL('citygo://'));
        }
      });

      return () => {
        appStateSubscription.remove();
        unsubscribeTokenRefresh();
        unsubscribeNotificationOpened();
        notificationResponseSubscription.remove();
      };
    }
  }, [isLoggedIn]);

  if (showSplash || !permissionsSettled) {
    return <LoadingScreen />;
  }

  if (!locationGranted) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          backgroundColor: "#f5f5f5",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            padding: 20,
            borderRadius: 12,
            width: "100%",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            elevation: 5, // 👈 clave en Android
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Permiso de ubicación requerido
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#666",
              marginBottom: 20,
            }}
          >
            Necesitamos acceso a tu ubicación para mostrar el mapa correctamente.
          </Text>

          {/* Botón secundario */}
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{
              borderWidth: 1,
              borderColor: "#007AFF",
              padding: 12,
              borderRadius: 8,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: "#007AFF", textAlign: "center", fontWeight: "600" }}>
              Abrir configuración
            </Text>
          </TouchableOpacity>

          {/* Botón principal */}
          <TouchableOpacity
            onPress={requestPermissions}
            style={{
              backgroundColor: "#007AFF",
              padding: 12,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>
              Conceder permisos
            </Text>
          </TouchableOpacity>


        </View>
      </SafeAreaView>
    );
  }

  if (!termsAccepted) return <TerminosScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        isApproved ? (
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        ) : (
          <Stack.Screen name="Pending" component={PendingApprovalScreen} />
        )
      ) : (
        <Stack.Screen name="WithoutLogin" component={WithoutLogin} />
      )}
    </Stack.Navigator>
  );
}

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Mensaje recibido en segundo plano:', remoteMessage);
  if (remoteMessage?.data?.rideId) {
    await AsyncStorage.setItem('activeRideId', String(remoteMessage.data.rideId));
  }
});

import { AlertProvider } from './utils/context/AlertContext';

export default function App() {

  return (
    <AlertProvider>
      <AuthProvider>
        <PermissionProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </PermissionProvider>
      </AuthProvider>
    </AlertProvider>
  );
}
