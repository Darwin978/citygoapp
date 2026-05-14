// PermissionContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert, Platform } from "react-native";

interface PermissionContextProps {
  locationGranted: boolean;
  audioGranted: boolean;
  termsAccepted: boolean;
  requestPermissions: () => Promise<void>;
  acceptTerms: () => Promise<void>;
  requestOverlayPermission: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextProps>({
  locationGranted: false,
  audioGranted: false,
  termsAccepted: false,
  requestPermissions: async () => { },
  acceptTerms: async () => { },
  requestOverlayPermission: async () => { },
});

export const PermissionProvider = ({ children }: any) => {
  const [locationGranted, setLocationGranted] = useState(false);
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

  const acceptTerms = async () => {
    await AsyncStorage.setItem("termsAccepted", "true");
    setTermsAccepted(true);
  };

  const requestOverlayPermission = async () => {
    if (Platform.OS !== "android") return;

    const asked = await AsyncStorage.getItem("overlayAsked");
    if (asked === "true") return;

    Alert.alert(
      "Permiso Importante",
      "Para que la aplicación se abra automáticamente cuando recibas una carrera o un mensaje, necesitas habilitar 'Mostrar sobre otras aplicaciones'.",
      [
        {
          text: "En otro momento",
          style: "cancel",
          onPress: () => AsyncStorage.setItem("overlayAsked", "true")
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
              // Si falla (por ejemplo en simuladores viejos o Expo Go sin configuración), intentar ajustes normales
              const { Linking } = require("react-native");
              Linking.openSettings();
            }
          }
        }
      ]
    );
  };

  return (
    <PermissionContext.Provider
      value={{
        locationGranted,
        audioGranted,
        termsAccepted,
        requestPermissions,
        acceptTerms,
        requestOverlayPermission,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);