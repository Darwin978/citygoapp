import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
    alert("Sesión cerrada");
  }
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400' }} 
            style={styles.profileImg} 
          />
          <TouchableOpacity style={styles.editBadge}>
            <Ionicons name="camera" size={18} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>Mateo Sebastian</Text>
        <Text style={styles.phone}>+593 99 888 7777</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>4.9</Text>
          <Text style={styles.statLab}>Calificación</Text>
        </View>
        <View style={[styles.statItem, styles.borderLateral]}>
          <Text style={styles.statVal}>124</Text>
          <Text style={styles.statLab}>Viajes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>$15.20</Text>
          <Text style={styles.statLab}>Crédito</Text>
        </View>
      </View>

      <View style={styles.menuSection}>
        <MenuOption icon="time-outline" title="Historial de viajes" />
        <MenuOption icon="card-outline" title="Métodos de pago" />
        <MenuOption icon="notifications-outline" title="Notificaciones" />
        <MenuOption icon="help-circle-outline" title="Soporte técnico" />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MenuOption({ icon, title }: any) {
  return (
    <TouchableOpacity style={styles.option}>
      <View style={styles.optionLeft}>
        <Ionicons name={icon} size={22} color="#1D4ED8" />
        <Text style={styles.optionTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#F8FAFC' },
  imageContainer: { marginBottom: 15 },
  profileImg: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: 'white' },
  editBadge: { position: 'absolute', bottom: 0, right: 5, backgroundColor: '#1D4ED8', padding: 8, borderRadius: 20 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1E3A8A' },
  phone: { color: '#6B7280', marginTop: 4 },
  
  statsRow: { flexDirection: 'row', paddingVertical: 25, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  statItem: { flex: 1, alignItems: 'center' },
  borderLateral: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F3F4F6' },
  statVal: { fontSize: 18, fontWeight: 'bold', color: '#1D4ED8' },
  statLab: { fontSize: 12, color: '#9CA3AF' },

  menuSection: { padding: 20 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  optionTitle: { marginLeft: 15, fontSize: 16, color: '#374151', fontWeight: '500' },
  logoutBtn: { marginTop: 40, alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#FEF2F2' },
  logoutText: { color: '#EF4444', fontWeight: 'bold' }
});