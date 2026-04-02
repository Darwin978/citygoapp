import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={50} color="white" />
        </View>
        <Text style={styles.name}>Juan Pérez</Text>
        <Text style={styles.roleTag}>Conductor Verificado</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONFIGURACIÓN DE CUENTA</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Ionicons name="mail-outline" size={22} color="#4B5563" />
            <Text style={styles.menuLabel}>Cambiar Correo</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Ionicons name="lock-closed-outline" size={22} color="#4B5563" />
            <Text style={styles.menuLabel}>Cambiar Contraseña</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SEGURIDAD Y PRIVACIDAD</Text>
        
        <View style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Ionicons name="finger-print-outline" size={22} color="#4B5563" />
            <Text style={styles.menuLabel}>Autenticación Biométrica</Text>
          </View>
          <Switch value={true} trackColor={{ true: '#1D4ED8' }} />
        </View>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Ionicons name="document-text-outline" size={22} color="#4B5563" />
            <Text style={styles.menuLabel}>Términos y Condiciones</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.logoutBtn} 
        onPress={() => navigation.replace('Login')}
      >
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
      
      <Text style={styles.version}>CityGo v1.0.0 - Cuenca, EC</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileCard: { backgroundColor: 'white', alignItems: 'center', padding: 30, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  roleTag: { backgroundColor: '#DBEafe', color: '#1D4ED8', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  section: { marginTop: 25, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 10, marginLeft: 5 },
  menuItem: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, elevation: 1 },
  menuIconText: { flexDirection: 'row', alignItems: 'center' },
  menuLabel: { marginLeft: 15, fontSize: 16, color: '#374151' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 15 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginVertical: 20 }
});