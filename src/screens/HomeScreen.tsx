import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Roles } from '../../utils/services/rolesEnum';
import DriverHomeScreen from './DriverHomeScreen';
import UserHomeScreen from './UserHomeScreen';

export default function HomeScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const savedRole = await AsyncStorage.getItem('role');
        setRole(savedRole);
      } catch (error) {
        console.log("Error al obtener el rol del usuario", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (role === Roles.DRIVER) {
    return <DriverHomeScreen />;
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