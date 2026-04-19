import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserInfoApi, getUserInfoApproved } from '../../utils/services/userService';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from '../../utils/context/AuthContext';

export default function PendingApprovalScreen({ navigation }: any) {
  const { aproveed, login, logout } = useAuth()
  useEffect(() => {
    handleGetInfo();
    const intervalTime = 1000 * 60 * 1; // Cada 1 minutos

    const interval = setInterval(handleGetInfo, intervalTime);

    return () => clearInterval(interval);
  }, []);
  
  async function handleGetInfo() {
    try {
      const token = await AsyncStorage.getItem('authToken') || '';
      const response = await getUserInfoApproved(token);
      console.log(response);
      
      if (response.isApproved) {
        aproveed(true);
        login()
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
    
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>En Revisión</Text>
      
      <View style={styles.iconCircle}>
        <View style={styles.innerCircle}>
          <Ionicons name="car" size={60} color="#1D4ED8" />
        </View>
        <Ionicons name="checkmark-circle" size={30} color="#9CA3AF" style={styles.checkIcon} />
      </View>

      <Text style={styles.mainMessage}>
        Tu cuenta está siendo revisada por el administrador.
      </Text>
      <Text style={styles.subMessage}>
        Te notificaremos una vez aprobada.
      </Text>
      <Text style={styles.timer}>Tiempo estimado: 24-48 horas.</Text>

      <TouchableOpacity style={styles.closeButton} onPress={logout}>
        <Text style={styles.closeButtonText}>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#FFF' },
  title: { fontSize: 24, color: '#9CA3AF', marginBottom: 50 },
  iconCircle: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  innerCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  checkIcon: { position: 'absolute', top: -5, right: 30 },
  mainMessage: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 40, color: '#1F2937' },
  subMessage: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#1F2937' },
  timer: { marginTop: 20, color: '#6B7280' },
  closeButton: { backgroundColor: '#D1D5DB', width: '100%', padding: 15, borderRadius: 10, marginTop: 50, alignItems: 'center' },
  closeButtonText: { color: '#4B5563', fontSize: 18, fontWeight: 'bold' }
});