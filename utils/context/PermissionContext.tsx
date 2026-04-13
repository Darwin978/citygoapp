// PermissionContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert } from "react-native";

interface PermissionContextProps {
  locationGranted: boolean;
  audioGranted: boolean;
  termsAccepted: boolean;
  requestPermissions: () => Promise<void>;
  acceptTerms: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextProps>({
  locationGranted: false,
  audioGranted: false,
  termsAccepted: false,
  requestPermissions: async () => {},
  acceptTerms: async () => {},
});

export const PermissionProvider = ({ children }:any) => {
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

  return (
    <PermissionContext.Provider
      value={{
        locationGranted,
        audioGranted,
        termsAccepted,
        requestPermissions,
        acceptTerms,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);