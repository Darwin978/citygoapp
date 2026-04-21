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
import { Linking, Platform, TouchableOpacity, View, Text } from 'react-native';
import { AndroidNotificationPriority } from 'expo-notifications';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from './utils/context/AuthContext';
import TerminosScreen from './src/components/TerminosCondiciones';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PermissionProvider, usePermissions } from './utils/context/PermissionContext';
import * as SplashScreen from 'expo-splash-screen';
import LoadingScreen from './src/screens/LoadingScreen';
import TabNavigator from './src/navigation/TabNavigator';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    // Estas son las que te pide el error:
    shouldShowBanner: true,
    shouldShowList: true,
    priority: AndroidNotificationPriority.MAX,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('rides-alerts', {
    name: 'Alertas de Carreras',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
    sound: 'default', // Aquí podrías poner un sonido personalizado de "taxi"
  });
}

async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('¡Debes habilitar las notificaciones para recibir carreras!');
    return;
  }
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
  const { termsAccepted, requestPermissions, locationGranted, audioGranted } = usePermissions();

  const [showSplash, setShowSplash] = useState(true);

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
    requestPermissions();
    registerForPushNotificationsAsync();
  }, []);


  if (showSplash) {
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

export default function App() {

  return (
    <AuthProvider>
      <PermissionProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}