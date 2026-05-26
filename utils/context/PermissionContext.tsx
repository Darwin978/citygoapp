// PermissionContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert, Platform } from "react-native";

interface PermissionContextProps {
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  audioGranted: boolean;
  termsAccepted: boolean;
  requestPermissions: () => Promise<void>;
  requestBackgroundLocationPermission: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  requestOverlayPermission: () => Promise<void>;
  /** Solicita exención de batería y, en dispositivos Xiaomi/MIUI, guía al usuario
   *  para activar las 3 restricciones propias de HyperOS que bloquean el FSI. */
  requestBatteryAndMiuiPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextProps>({
  locationGranted: false,
  backgroundLocationGranted: false,
  audioGranted: false,
  termsAccepted: false,
  requestPermissions: async () => { },
  requestBackgroundLocationPermission: async () => { },
  acceptTerms: async () => { },
  requestOverlayPermission: async () => { },
  requestBatteryAndMiuiPermissions: async () => { },
});

export const PermissionProvider = ({ children }: any) => {
  const [locationGranted, setLocationGranted] = useState(false);
  const [backgroundLocationGranted, setBackgroundLocationGranted] = useState(false);
  const [audioGranted, setAudioGranted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    loadInitialValues();
  }, []);

  const loadInitialValues = async () => {
    const terms = await AsyncStorage.getItem("termsAccepted");
    setTermsAccepted(terms === "true");

    const loc = await Location.getForegroundPermissionsAsync();
    setLocationGranted(loc.status === "granted");

    // Verificar también el permiso de background (Android 10+ / iOS "Always")
    const bgLoc = await Location.getBackgroundPermissionsAsync();
    setBackgroundLocationGranted(bgLoc.status === "granted");
  };

  const requestPermissions = async () => {
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

    if (locStatus !== "granted") {
      Alert.alert("Permisos necesarios", "Esta aplicación necesita acceso a la ubicación para funcionar.");
      setLocationGranted(false);
      return;
    }

    setLocationGranted(true);
  };

  /**
   * Solicita permiso de ubicación "siempre" (ACCESS_BACKGROUND_LOCATION en Android,
   * "Siempre" en iOS). Se llama SÓLO para conductores después de que el permiso
   * de foreground ya fue concedido.
   *
   * Android 10+: redirige al usuario a Ajustes para que seleccione "Permitir todo el tiempo".
   * iOS: muestra el diálogo de "Cambiar a siempre".
   */
  const requestBackgroundLocationPermission = async () => {
    // Verificar si ya tiene el permiso
    const existing = await Location.getBackgroundPermissionsAsync();
    if (existing.status === "granted") {
      setBackgroundLocationGranted(true);
      return;
    }

    // En Android < 10 no existe este concepto; el foreground ya es suficiente
    if (Platform.OS === "android" && Number(Platform.Version) < 29) {
      setBackgroundLocationGranted(true);
      return;
    }

    await new Promise<void>((resolve) => {
      Alert.alert(
        "Ubicación en segundo plano",
        Platform.OS === "android"
          ? "Para recibir carreras incluso con la pantalla apagada, selecciona \"Permitir todo el tiempo\" en la siguiente pantalla."
          : "Para rastrear tu posición mientras la app está en segundo plano, selecciona \"Siempre\" en la siguiente pantalla.",
        [
          {
            text: "Ahora no",
            style: "cancel",
            onPress: () => resolve(),
          },
          {
            text: "Configurar",
            onPress: async () => {
              const { status } = await Location.requestBackgroundPermissionsAsync();
              setBackgroundLocationGranted(status === "granted");
              resolve();
            },
          },
        ]
      );
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BATERÍA Y PERMISOS MIUI/HYPEROS
  //
  // En Xiaomi (MIUI / HyperOS) hay 3 capas de restricciones que bloquean el
  // Full Screen Intent INDEPENDIENTEMENTE del permiso USE_FULL_SCREEN_INTENT:
  //
  //   1. Batería → Ahorro de batería de apps → CityGo → Sin restricciones
  //      Sin esto Android puede matar el proceso que lanza la actividad.
  //
  //   2. Aplicaciones → Administrar apps → CityGo → Inicio automático
  //      Sin esto FCM no puede despertar la app cuando está cerrada.
  //
  //   3. Administrar apps → CityGo → Otros permisos →
  //      "Mostrar ventanas emergentes mientras se ejecuta en segundo plano"
  //      Esta es la que DIRECTAMENTE bloquea el FSI en HyperOS; no tiene
  //      equivalente en Android puro y no se puede otorgar programáticamente.
  //
  // Esta función guía al usuario para activar las tres y solicita exención
  // de batería via el intent estándar de Android como paso previo.
  // ─────────────────────────────────────────────────────────────────────────
  const requestBatteryAndMiuiPermissions = async () => {
    if (Platform.OS !== "android") return;

    const asked = await AsyncStorage.getItem("batteryMiuiAsked");
    if (asked === "true") return;
    await AsyncStorage.setItem("batteryMiuiAsked", "true");

    // Detectar Xiaomi / Redmi / POCO (todos usan MIUI o HyperOS)
    const constants = (Platform as any).constants ?? {};
    const brand        = (constants.Brand        ?? "").toLowerCase();
    const manufacturer = (constants.Manufacturer ?? "").toLowerCase();
    const isMiui = ["xiaomi", "redmi", "poco"].some(
      b => brand.includes(b) || manufacturer.includes(b)
    );

    const openAppSettings = async () => {
      try {
        // Abre la página de "info de app" de CityGo en el gestor de apps
        const IntentLauncher = require("expo-intent-launcher");
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: "package:com.citygo" }
        );
      } catch (_e) {
        const { Linking } = require("react-native");
        Linking.openSettings();
      }
    };

    if (isMiui) {
      // ── Guía paso a paso para Xiaomi / HyperOS ──────────────────────────
      await new Promise<void>((resolve) => {
        Alert.alert(
          "⚙️ Configuración requerida en Xiaomi",
          "Para que las alertas de nuevas carreras aparezcan en pantalla completa debes activar estas 3 opciones:\n\n" +
          "1️⃣  Ajustes → Batería → Ahorro de batería de apps → CityGo → Sin restricciones\n\n" +
          "2️⃣  Ajustes → Aplicaciones → Gestionar apps → CityGo → Inicio automático → Activar\n\n" +
          "3️⃣  Gestionar apps → CityGo → Otros permisos → Mostrar ventanas emergentes mientras se ejecuta en segundo plano → Permitir",
          [
            {
              text: "Abrir ajustes de CityGo",
              onPress: async () => { await openAppSettings(); resolve(); },
            },
            {
              text: "Ya lo hice",
              style: "cancel",
              onPress: () => resolve(),
            },
          ],
          { cancelable: false }
        );
      });
    } else {
      // ── Solicitud estándar de exención de batería (Android 6+) ──────────
      await new Promise<void>((resolve) => {
        Alert.alert(
          "Optimización de batería",
          "Para recibir alertas de carreras con la pantalla apagada, desactiva la optimización de batería para CityGo.",
          [
            {
              text: "Desactivar",
              onPress: async () => {
                try {
                  const IntentLauncher = require("expo-intent-launcher");
                  // Este intent abre el diálogo del sistema "¿Ignorar optimizaciones?"
                  await IntentLauncher.startActivityAsync(
                    "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
                    { data: "package:com.citygo" }
                  );
                } catch (_e) {
                  await openAppSettings();
                }
                resolve();
              },
            },
            {
              text: "Después",
              style: "cancel",
              onPress: () => resolve(),
            },
          ]
        );
      });
    }
  };

  const acceptTerms = async () => {
    await AsyncStorage.setItem("termsAccepted", "true");
    setTermsAccepted(true);
  };

  let isRequestingOverlay = false;

  const requestOverlayPermission = async () => {
    if (Platform.OS !== "android") return;
    if (isRequestingOverlay) return;
    isRequestingOverlay = true;

    try {
      const asked = await AsyncStorage.getItem("overlayAsked");
      if (asked !== "true") {
        await new Promise<void>((resolve) => {
          Alert.alert(
            "Permiso Importante",
            "Para que CityGo pueda aparecer sobre otras aplicaciones cuando tengas notificaciones de una carrera, habilita 'Mostrar sobre otras aplicaciones'.",
            [
              {
                text: "En otro momento",
                style: "cancel",
                onPress: () => {
                  AsyncStorage.setItem("overlayAsked", "true");
                  resolve();
                }
              },
              {
                text: "Configurar",
                onPress: async () => {
                  await AsyncStorage.setItem("overlayAsked", "true");
                  try {
                    const IntentLauncher = require("expo-intent-launcher");
                    await IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION,
                      { data: "package:com.citygo" }
                    );
                  } catch (e) {
                    const { Linking } = require("react-native");
                    Linking.openSettings();
                  }
                  resolve();
                }
              }
            ]
          );
        });
      }

      const fullScreenAsked = await AsyncStorage.getItem("fullScreenIntentAsked");
      if (Number(Platform.Version) < 34 || fullScreenAsked === "true") return;

      return await new Promise<void>((resolve) => {
        Alert.alert(
          "Alertas de carrera",
          "Para mostrar carreras en pantalla completa incluso con el teléfono bloqueado, permite las notificaciones de pantalla completa de CityGo.",
          [
            {
              text: "En otro momento",
              style: "cancel",
              onPress: () => {
                AsyncStorage.setItem("fullScreenIntentAsked", "true");
                resolve();
              }
            },
            {
              text: "Configurar",
              onPress: async () => {
                await AsyncStorage.setItem("fullScreenIntentAsked", "true");
                try {
                  const IntentLauncher = require("expo-intent-launcher");
                  await IntentLauncher.startActivityAsync(
                    "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                    { data: "package:com.citygo" }
                  );
                } catch (e) {
                  const { Linking } = require("react-native");
                  Linking.openSettings();
                }
                resolve();
              }
            }
          ]
        );
      });
    } finally {
      isRequestingOverlay = false;
    }
  };

  return (
    <PermissionContext.Provider
      value={{
        locationGranted,
        backgroundLocationGranted,
        audioGranted,
        termsAccepted,
        requestPermissions,
        requestBackgroundLocationPermission,
        acceptTerms,
        requestOverlayPermission,
        requestBatteryAndMiuiPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);
