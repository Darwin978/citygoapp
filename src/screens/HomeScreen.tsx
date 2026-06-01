import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Roles } from '../../utils/services/rolesEnum';
import DriverHomeScreen from './DriverHomeScreen';
import UserHomeScreen from './UserHomeScreen';

const DRIVER_ONLINE_KEY = 'driverOnlineState';

export default function HomeScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // null = aún no leído de AsyncStorage (evita flash de pantalla incorrecta)
  const [isDriverOnline, setIsDriverOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const savedRole = await AsyncStorage.getItem('role');
        setRole(savedRole);

        if (savedRole === Roles.DRIVER) {
          // Restaurar el último estado online/offline del conductor.
          // Si no hay valor guardado (primera vez) se asume online.
          const saved = await AsyncStorage.getItem(DRIVER_ONLINE_KEY);
          setIsDriverOnline(saved === null ? true : saved === 'true');
        } else {
          // Para clientes puros, isDriverOnline no aplica pero debe salir de null
          // para que el spinner no se quede infinito.
          setIsDriverOnline(false);
        }
      } catch (error) {
        console.log("Error al obtener el estado inicial del conductor", error);
        setIsDriverOnline(true);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialState();
  }, []);

  const handleGoOffline = async () => {
    await AsyncStorage.setItem(DRIVER_ONLINE_KEY, 'false');
    setIsDriverOnline(false);
  };

  const handleGoOnline = async () => {
    await AsyncStorage.setItem(DRIVER_ONLINE_KEY, 'true');
    setIsDriverOnline(true);
  };

  // Mostrar spinner mientras se leen AsyncStorage (evita flash entre pantallas)
  if (loading || isDriverOnline === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (role === Roles.DRIVER) {
    if (isDriverOnline) {
      return <DriverHomeScreen onOffline={handleGoOffline} />;
    } else {
      return <UserHomeScreen onOnline={handleGoOnline} isDriverOffline={true} />;
    }
  }

  // Fallback a UserHomeScreen por defecto (o si el rol es USER/CLIENT)
  return <UserHomeScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});