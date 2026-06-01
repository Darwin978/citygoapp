import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RegisterScreen from './src/screens/RegisterScreen';
import PendingApprovalScreen from './src/screens/PendingApprovalScreen';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();

import * as Notifications from 'expo-notifications';
import { Linking, Platform, TouchableOpacity, View, Text, AppState, Alert, PermissionsAndroid } from 'react-native';
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
import { BACKEND_URL } from './utils/services/apiConfig';

// @notifee: gestión avanzada de notificaciones con soporte Full Screen Intent
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidLaunchActivityFlag,
  AndroidNotificationSetting,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────
// VERSIÓN DEL CANAL DE CARRERAS
// En Android los canales son INMUTABLES una vez creados: cambiar nombre, sonido,
// bypassDnd o importancia en un canal existente no tiene efecto. La única forma
// correcta de "actualizar" un canal es subir la versión del ID y eliminar el
// anterior. setupNotifeeChannels() se encarga de esa migración automáticamente.
// ──────────────────────────────────────────────────────────────────────────────
const RIDE_CHANNEL_ID = 'rides-critical-v3';   // ← sube aquí cuando necesites cambiar propiedades
const MSG_CHANNEL_ID = 'messages-channel';
const STATUS_CHANNEL_ID = 'status-channel';
const RIDE_DEEPLINK_PREFIX = 'citygo://ride';
const ACCEPT_RIDE_ACTION_ID = 'accept_ride';
const VIEW_RIDE_ACTION_ID = 'view_ride';

// ─────────────────────────────────────────────────────────────────────────────
// CANALES ANDROID (expo-notifications — para notificaciones vía scheduleNotification)
// Se crean al arrancar la app. Son persistentes: si ya existen no se duplican.
// ─────────────────────────────────────────────────────────────────────────────
// CANALES expo-notifications (Android) — SOLO para MSG y STATUS
//
// Regla: una librería por canal para evitar perfiles mezclados.
//   • rides-critical-v3  → creado y usado ÚNICAMENTE por @notifee (FSI requiere notifee)
//   • messages-channel   → creado y usado ÚNICAMENTE por expo-notifications ← aquí
//   • status-channel     → creado y usado ÚNICAMENTE por expo-notifications ← aquí
//
// expo-notifications hereda el ícono del manifest
// (default_notification_icon = @drawable/ic_notification) automáticamente.
// ─────────────────────────────────────────────────────────────────────────────
if (Platform.OS === 'android') {
  // Canal mensajes: prioridad alta pero no intrusiva
  Notifications.setNotificationChannelAsync(MSG_CHANNEL_ID, {
    name: 'Mensajes del viaje',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [1, 200],
    sound: 'default',
  });

  // Canal estados: informativo, sin sonido
  Notifications.setNotificationChannelAsync(STATUS_CHANNEL_ID, {
    name: 'Estado del viaje',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Handler de expo-notifications: aplica cuando la app está en foreground y llega
// una notificación agendada (scheduleNotificationAsync). Las notificaciones de
// carreras nuevas las manejamos con @notifee, pero dejamos este handler activo
// para el resto.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const channelId = (notification.request.trigger as any)?.channelId ?? '';
    const isRide = channelId === RIDE_CHANNEL_ID;
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isRide
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CANALES @notifee (Android) — para notificaciones con Full Screen Intent
// ─────────────────────────────────────────────────────────────────────────────
// IDs de canales que ya no se usan y deben borrarse en la migración.
// Añade aquí cualquier ID antiguo cuando subas la versión de RIDE_CHANNEL_ID.
const DEPRECATED_CHANNEL_IDS = [
  'rides-critical-v2', // reemplazado por rides-critical-v3
  'rides-critical-v1', // por si existiera de versiones anteriores
];

async function setupNotifeeChannels() {
  if (Platform.OS !== 'android') return;

  // ── Migración de canales obsoletos ────────────────────────────────────────
  // Elimina canales de versiones anteriores para que el dispositivo adopte la
  // nueva configuración. @notifee y expo-notifications comparten el mismo
  // NotificationManager de Android, así que una llamada de deleteChannel
  // borra el canal del sistema para ambas librerías.
  for (const oldId of DEPRECATED_CHANNEL_IDS) {
    await notifee.deleteChannel(oldId).catch(() => {/* ya no existía, ignorar */ });
  }

  // ── Canal de carreras (solo @notifee gestiona este canal) ─────────────────
  // MSG y STATUS los crea expo-notifications (ver bloque superior).
  // Regla: una librería por canal → sin perfiles mezclados.
  await notifee.createChannel({
    id: RIDE_CHANNEL_ID,
    name: 'Carreras urgentes',
    importance: AndroidImportance.HIGH,
    vibration: true,
    vibrationPattern: [1, 500, 250, 500, 250, 800],
    sound: 'notificacion',
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICACIÓN DE NUEVA CARRERA (máxima prioridad, Full Screen Intent)
// Se usa tanto en foreground (onMessage) como en background (setBackgroundMessageHandler).
// ─────────────────────────────────────────────────────────────────────────────
async function showRideNotification(
  title: string,
  body: string,
  rideId: string,
  type: 'NEW_RIDE' | 'ARRIVED' = 'NEW_RIDE',
) {
  const isNewRide = type === 'NEW_RIDE';

  if (Platform.OS === 'android') {
    try {
      // Crear el canal aquí garantiza que existe incluso en contexto headless
      // (el background handler corre SIN pasar por useEffect/setupNotifeeChannels).
      // Si el canal ya existe con el mismo ID, createChannel es idempotente.
      await notifee.createChannel({
        id: RIDE_CHANNEL_ID,
        name: 'Carreras urgentes',
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [1, 500, 250, 500, 250, 800],
        sound: 'notificacion',
        bypassDnd: true,
        visibility: AndroidVisibility.PUBLIC,
      });

      await notifee.displayNotification({
        title: `<b>${title}</b>`,
        body,
        android: {
          channelId: RIDE_CHANNEL_ID,
          // @notifee NO hereda el icono del meta-data del manifest; hay que declararlo
          // explícitamente. Usamos el mismo drawable que usa expo-notifications:
          // android/app/src/main/res/drawable/ic_notification.png
          smallIcon: 'ic_notification',
          color: '#1D4ED8',
          // Categoría CALL: el sistema trata la notificación como una llamada entrante
          // y le da prioridad máxima en la pantalla de bloqueo
          category: AndroidCategory.CALL,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          // Vibración: se hereda del canal; repetirla aquí reafirza el patrón.
          // NOTA: sound solo se configura en el canal (Android 8+); ponerlo en la
          // notificación individual no tiene efecto y puede confundir a notifee.
          vibrationPattern: [1, 500, 250, 500, 250, 800],
          // ─── Full Screen Intent ──────────────────────────────────────────
          // Muestra la app como overlay (tipo llamada entrante) cuando el
          // dispositivo está bloqueado o en uso por otra app.
          // Requiere USE_FULL_SCREEN_INTENT + SYSTEM_ALERT_WINDOW en el manifest.
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default', // abre MainActivity
            launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK, AndroidLaunchActivityFlag.SINGLE_TOP],
          },
          pressAction: {
            id: 'default',
            launchActivity: 'default',
            launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK, AndroidLaunchActivityFlag.SINGLE_TOP],
          },
          actions: isNewRide
            ? [
              {
                title: 'Aceptar',
                pressAction: {
                  id: ACCEPT_RIDE_ACTION_ID,
                },
              },
              {
                title: 'Ver carrera',
                pressAction: {
                  id: VIEW_RIDE_ACTION_ID,
                  launchActivity: 'default',
                  launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK, AndroidLaunchActivityFlag.SINGLE_TOP],
                },
              },
            ]
            : undefined,
          showTimestamp: true,
        },
        data: { rideId, type },
      });

      console.log('[Notifee] ✅ Full Screen Intent mostrado para rideId:', rideId);
    } catch (err) {
      console.error('[Notifee] ❌ Error al mostrar notificación FSI:', err);
    }
  } else {
    // iOS: @notifee gestiona la notificación de alta prioridad
    // (Critical Alerts requieren permiso especial de Apple; time-sensitive es lo máximo
    // sin ese permiso y sí aparece en pantalla de bloqueo y en Focus Mode)
    await notifee.displayNotification({
      title,
      body,
      ios: {
        sound: 'notificacion.mp3',
        interruptionLevel: 'timeSensitive',
        foregroundPresentationOptions: {
          alert: true,
          sound: true,
          badge: true,
          banner: true,
          list: true,
        },
      },
      data: { rideId, type },
    });
  }
}

// Notificación simple para mensajes y estados (sin Full Screen Intent)
async function showSimpleNotification(
  title: string,
  body: string,
  channelId: string,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: channelId === MSG_CHANNEL_ID ? 'default' : undefined,
    },
    trigger: Platform.OS === 'android' ? { channelId } as any : null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE TOKEN FCM
// ─────────────────────────────────────────────────────────────────────────────
async function registerForPushNotificationsAsync(shouldRequest = true) {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (!hasPermission) {
      if (shouldRequest) {
        // Rationale previa obligatoria antes del diálogo del sistema (política Google Play)
        await new Promise<void>((resolve) => {
          Alert.alert(
            'Notificaciones de CityGo',
            'Necesitamos enviarte notificaciones para:\n\n' +
            '• Avisarte cuando un conductor acepte tu viaje\n' +
            '• Informarte cuando el conductor haya llegado\n' +
            '• Recibir solicitudes de nuevas carreras (conductores)\n' +
            '• Mensajes del chat durante el viaje\n\n' +
            'Puedes desactivarlas en cualquier momento desde Ajustes.',
            [{ text: 'Continuar', onPress: () => resolve() }],
            { cancelable: false }
          );
        });

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Notificaciones desactivadas',
            'Sin notificaciones no podrás recibir alertas de carreras ni mensajes. ' +
            'Actívalas en Ajustes → Apps → CityGo → Notificaciones.'
          );
          return;
        }
      } else {
        return;
      }
    }
  }

  const authStatus = shouldRequest
    ? await messaging().requestPermission()
    : await messaging().hasPermission();

  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    if (shouldRequest) Alert.alert('¡Debes habilitar las notificaciones para recibir carreras!');
    return;
  }

  try {
    const token = await messaging().getToken();
    console.log('[FCM] Token:', token);
    await saveTokenInBackend(token);
  } catch (error) {
    console.log('[FCM] Error obteniendo token:', error);
  }
}

async function openRideFromNotification(remoteMessage?: any) {
  const rideId = remoteMessage?.data?.rideId;
  const type = remoteMessage?.data?.type as string | undefined;
  if (!rideId) {
    Linking.openURL('citygo://').catch(err => console.log('[DeepLink] Error:', err));
    return;
  }
  await AsyncStorage.setItem('activeRideId', String(rideId));
  // Guardar el tipo para que DriverHomeScreen sepa si debe mostrar el diálogo
  // de solicitud pendiente (NEW_RIDE) o simplemente retomar un viaje en curso.
  if (type) await AsyncStorage.setItem('pendingNotifType', type);
  Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() =>
    Linking.openURL('citygo://').catch(err => console.log('[DeepLink] Error:', err))
  );
}

async function acceptRideFromNotification(rideId: string) {
  const token = await AsyncStorage.getItem('authToken');
  if (!token) {
    await AsyncStorage.setItem('pendingNotifAction', ACCEPT_RIDE_ACTION_ID);
    return false;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/ride/${rideId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== 'success') {
      await AsyncStorage.setItem('pendingNotifAction', ACCEPT_RIDE_ACTION_ID);
      return false;
    }

    await AsyncStorage.setItem('activeRideId', rideId);
    await AsyncStorage.removeItem('pendingNotifAction');
    await AsyncStorage.removeItem('pendingNotifType');
    return true;
  } catch (error) {
    await AsyncStorage.setItem('pendingNotifAction', ACCEPT_RIDE_ACTION_ID);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER DE MENSAJES EN SEGUNDO PLANO / APP CERRADA (FCM)
//
// Este handler corre en un contexto headless (React Native sin UI) cuando:
//   - La app está en background  (pantalla apagada / otra app en foco)
//   - La app está completamente cerrada (killed)
//
// Android: FCM data-only con priority:high despierta el dispositivo y ejecuta esto.
//          Usamos @notifee con fullScreenIntent para la notificación.
// iOS:     El sistema ya mostró la alerta via APNS. Aquí solo guardamos el rideId.
// ─────────────────────────────────────────────────────────────────────────────
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM-BG] Mensaje recibido en background/killed:', remoteMessage);

  const data = remoteMessage?.data ?? {};
  const type = (data.type as string) ?? 'STATUS';
  const rideId = (data.rideId as string) ?? (data.tripId as string) ?? '';
  const title = (data.title as string) ?? 'CityGo';
  const body = (data.body as string) ?? '';

  // Almacenar el rideId para que restoreSession lo encuentre al abrir la app
  if (rideId) {
    await AsyncStorage.setItem('activeRideId', String(rideId));
  }

  if (Platform.OS === 'android') {
    // En Android el sistema NO muestra nada automáticamente (mensaje data-only).
    // Nosotros creamos la notificación con @notifee.
    if (type === 'NEW_RIDE' || type === 'ARRIVED') {
      // NEW_RIDE → conductor recibe FSI con solicitud de carrera
      // ARRIVED  → cliente recibe FSI cuando el conductor ya está esperando afuera
      await showRideNotification(title, body, rideId, type);
    } else if (type === 'MESSAGE') {
      await showSimpleNotification(title, body, MSG_CHANNEL_ID);
    } else {
      await showSimpleNotification(title, body, STATUS_CHANNEL_ID);
    }
  }
  // iOS: la notificación ya fue mostrada por APNS. Solo necesitábamos el rideId arriba.
});

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER DE EVENTOS @notifee EN BACKGROUND
// Se ejecuta cuando el usuario interactúa con una notificación de @notifee mientras
// la app está en background (tap en la notificación, botón de acción, etc.).
// ─────────────────────────────────────────────────────────────────────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    const rideId = detail.notification?.data?.rideId as string | undefined;
    const notifType = detail.notification?.data?.type as string | undefined;
    const actionId = detail.pressAction?.id;
    if (rideId) {
      await AsyncStorage.setItem('activeRideId', rideId);
      if (notifType) await AsyncStorage.setItem('pendingNotifType', notifType);
      if (actionId === ACCEPT_RIDE_ACTION_ID) {
        await acceptRideFromNotification(rideId);
      }
      Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() => { });
    }
  }
});

// El botón "Aceptar" debe funcionar incluso si la app ya está abierta y la
// pantalla del conductor todavía no procesó el evento local.
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type !== EventType.ACTION_PRESS) return;
  const rideId = detail.notification?.data?.rideId as string | undefined;
  const notifType = detail.notification?.data?.type as string | undefined;
  const actionId = detail.pressAction?.id;

  if (!rideId) return;

  await AsyncStorage.setItem('activeRideId', rideId);
  if (notifType) await AsyncStorage.setItem('pendingNotifType', notifType);

  if (actionId === ACCEPT_RIDE_ACTION_ID) {
    await acceptRideFromNotification(rideId);
    if (detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
  }

  Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() => { });
});

// ─────────────────────────────────────────────────────────────────────────────
// NAVEGADORES
// ─────────────────────────────────────────────────────────────────────────────
export function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NAVIGATOR — lógica de permisos, tokens FCM y ubicación en background
// ─────────────────────────────────────────────────────────────────────────────
function RootNavigator() {
  const { isLoggedIn, isApproved } = useAuth();
  const {
    termsAccepted,
    requestPermissions,
    requestBackgroundLocationPermission,
    locationGranted,
    requestOverlayPermission,
    requestBatteryAndMiuiPermissions,
  } = usePermissions();

  const [showSplash, setShowSplash] = useState(true);
  const [permissionsSettled, setPermissionsSettled] = useState(false);

  // ── Ocultar splash ──────────────────────────────────────────────────────
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => { });
    const t = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // ── Crear canales @notifee al arrancar ──────────────────────────────────
  useEffect(() => {
    setupNotifeeChannels();
  }, []);

  // ── Handler de mensajes FCM en FOREGROUND ───────────────────────────────
  // onMessage se llama cuando la app está activa y llega un mensaje FCM.
  // La UI del socket (newRideRequest en DriverHomeScreen) ya muestra el diálogo;
  // aquí solo añadimos el sonido/notificación correspondiente por tipo.
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('[FCM-FG] Mensaje en foreground:', remoteMessage);
      const fgData = remoteMessage?.data ?? {};
      const type = (fgData.type as string) ?? 'STATUS';
      const title = (fgData.title as string) ?? 'CityGo';
      const body = (fgData.body as string) ?? '';
      const rideId = (fgData.rideId as string) ?? '';

      if (type === 'NEW_RIDE' || type === 'ARRIVED') {
        // NEW_RIDE → sonido/vibración para conductor (el diálogo lo abre el socket)
        // ARRIVED  → FSI para cliente cuando el conductor ya espera afuera
        await showRideNotification(title, body, rideId, type);
      } else if (type === 'MESSAGE') {
        await showSimpleNotification(title, body, MSG_CHANNEL_ID);
      } else {
        await showSimpleNotification(title, body, STATUS_CHANNEL_ID);
      }
    });
    return unsubscribe;
  }, []);

  // ── Permisos + token FCM ─────────────────────────────────────────────────
  useEffect(() => {
    if (showSplash) return;

    let isMounted = true;
    const initPermissions = async () => {
      setPermissionsSettled(false);

      // 1. Ubicación en primer plano (necesaria para todos)
      await requestPermissions();

      if (isLoggedIn) {
        // 2. Notificaciones push + token FCM
        await registerForPushNotificationsAsync(true);
        // 3. Overlay (mostrar sobre otras apps) + USE_FULL_SCREEN_INTENT (Android 14+)
        await requestOverlayPermission();

        // 4. Exención de batería + permisos MIUI/HyperOS (solo conductores;
        //    son los que reciben FSI y necesitan estas restricciones desactivadas)
        const role = await AsyncStorage.getItem('role');
        if (role === 'DRIVER') {
          await requestBatteryAndMiuiPermissions();
          await requestBackgroundLocationPermission();
        }

        // 5. Verificar en runtime que USE_FULL_SCREEN_INTENT sigue activo
        //    (el usuario puede haberlo desactivado después de instalación).
        //    Solo aplica Android 14+ (API 34); en versiones anteriores el valor
        //    será NOT_SUPPORTED y lo ignoramos.
        if (Platform.OS === 'android' && Number(Platform.Version) >= 34) {
          try {
            const ns = await notifee.getNotificationSettings();
            const fullScreenIntentSetting = (ns.android as any)?.fullScreenIntent;
            if (fullScreenIntentSetting === AndroidNotificationSetting.DISABLED) {
              Alert.alert(
                '⚠️ Alertas en pantalla completa desactivadas',
                'Las notificaciones de carreras no pueden aparecer sobre la pantalla de bloqueo. ' +
                'Actívalas en:\n\nAjustes → Apps → CityGo → Notificaciones → Mostrar en pantalla completa',
                [
                  {
                    text: 'Abrir ajustes',
                    onPress: async () => {
                      try {
                        const IL = require('expo-intent-launcher');
                        await IL.startActivityAsync(
                          'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
                          { data: 'package:com.citygo' }
                        );
                      } catch (_e) {
                        Linking.openSettings();
                      }
                    },
                  },
                  { text: 'Ignorar', style: 'cancel' },
                ]
              );
            }
          } catch (_e) {
            // getNotificationSettings puede fallar en builds de desarrollo; ignorar
          }
        }
      }

      if (isMounted) setPermissionsSettled(true);
    };

    initPermissions();

    if (isLoggedIn) {
      const appStateSubscription = AppState.addEventListener('change', nextState => {
        if (nextState === 'active') {
          registerForPushNotificationsAsync(false);
        }
      });

      const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
        console.log('[FCM] Token refrescado:', token);
        await saveTokenInBackend(token);
      });

      const unsubscribeOpened = messaging().onNotificationOpenedApp(openRideFromNotification);
      messaging().getInitialNotification().then(openRideFromNotification);

      // expo-notifications: cubre notifs de MENSAJE (y cualquier otra que no sea notifee)
      const notifResponseSub = Notifications.addNotificationResponseReceivedListener(async response => {
        const data = response.notification.request.content.data ?? {};
        const rideId = data.rideId as string | undefined;
        const type = data.type as string | undefined;
        if (rideId) {
          await AsyncStorage.setItem('activeRideId', String(rideId));
          if (type) await AsyncStorage.setItem('pendingNotifType', type);
          Linking.openURL(`${RIDE_DEEPLINK_PREFIX}/${rideId}`).catch(() =>
            Linking.openURL('citygo://')
          );
        }
      });

      return () => {
        isMounted = false;
        appStateSubscription.remove();
        unsubscribeTokenRefresh();
        unsubscribeOpened();
        notifResponseSub.remove();
      };
    }

    return () => { isMounted = false; };
  }, [isLoggedIn, showSplash]);

  // ── Ubicación en segundo plano (foreground service) ──────────────────────
  // Inicia la tarea LOCATION_TASK (definida en index.ts) que envía la posición
  // al backend via REST cada ~15 s incluso con la pantalla apagada.
  // Solo se inicia para conductores con los permisos correctos.
  useEffect(() => {
    const startBackgroundLocation = async () => {
      if (!isLoggedIn || !locationGranted) return;

      const role = await AsyncStorage.getItem('role');
      if (role !== 'DRIVER') return;

      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync('LOCATION_TASK');
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync('LOCATION_TASK', {
            accuracy: Location.Accuracy.High,
            // timeInterval: cuántos ms mínimo entre actualizaciones
            timeInterval: 10_000,   // 10 segundos (activo)
            // distanceInterval: solo actualiza si se movió X metros (ahorra batería)
            distanceInterval: 15,
            // Foreground service (Android): mantiene el proceso vivo con
            // una notificación persistente en la barra de estado
            foregroundService: {
              notificationTitle: 'CityGo activo',
              notificationBody: 'Estás disponible para recibir carreras.',
              notificationColor: '#1D4ED8',
            },
            // pausesUpdatesAutomatically: false en iOS para no pausar
            pausesUpdatesAutomatically: false,
            // showsBackgroundLocationIndicator: indicador visual en iOS
            showsBackgroundLocationIndicator: true,
          });
          console.log('[BG-LOCATION] Tarea LOCATION_TASK iniciada');
        }
      } catch (err) {
        console.error('[BG-LOCATION] Error al iniciar tarea:', err);
      }
    };

    startBackgroundLocation();
  }, [isLoggedIn, locationGranted]);

  // ── Pantallas de espera / error ──────────────────────────────────────────
  if (showSplash || !permissionsSettled) {
    return <LoadingScreen />;
  }

  if (!locationGranted) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' }}>
        <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', elevation: 5 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
            Permiso de ubicación requerido
          </Text>
          <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>
            Necesitamos acceso a tu ubicación para mostrar el mapa correctamente.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{ borderWidth: 1, borderColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 10 }}
          >
            <Text style={{ color: '#007AFF', textAlign: 'center', fontWeight: '600' }}>
              Abrir configuración
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={requestPermissions}
            style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
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
