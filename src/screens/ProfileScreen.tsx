import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Linking, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../../utils/services/apiConfig';
import { getUserInfoApi } from '../../utils/services/userService';
import { Roles } from '../../utils/services/rolesEnum';
import { addVehicleApi, deleteVehicleApi, getUserVehicles, setActiveVehicle } from '../../utils/services/vehicleService';
export default function ProfileScreen() {
  const { logout } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isVehiclesModalVisible, setIsVehiclesModalVisible] = useState(false);
  const [isAddVehicleModalVisible, setIsAddVehicleModalVisible] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ marca: '', modelo: '', placa: '', color: '' });

  useFocusEffect(
    useCallback(() => {
      getUserInfo(); // Cargar inmediatamente al entrar a la pestaña
      loadRoleAndVehicles();
      const interval = setInterval(() => {
        getUserInfo();
        loadRoleAndVehicles();
      }, 60000);
      return () => clearInterval(interval);
    }, [])
  );

  const loadRoleAndVehicles = async () => {
    const savedRole = await AsyncStorage.getItem('role');
    setRole(savedRole);
    if (savedRole === Roles.DRIVER) {
      const vehicles = await getUserVehicles()
      if (vehicles) {
        setVehicles(vehicles);
      } else {
        setVehicles([]);
      }
    }
  };

  const handleAddVehicle = async () => {
    if (!newVehicle.marca || !newVehicle.modelo || !newVehicle.placa || !newVehicle.color) {
      Alert.alert("Error", "Por favor llena todos los campos");
      return;
    }
    if (vehicles.length >= 3) {
      Alert.alert("Límite alcanzado", "No puedes agregar más de 3 vehículos");
      return;
    }
    try {

      const vehicle = {
        brand: newVehicle.marca,
        model: newVehicle.modelo,
        plate: newVehicle.placa,
        color: newVehicle.color,
      };
      const response = await addVehicleApi(vehicle);
      if (response) {
        Alert.alert("Éxito", "Vehículo agregado correctamente");
        await loadRoleAndVehicles();
        setNewVehicle({ marca: '', modelo: '', placa: '', color: '' });
        setIsAddVehicleModalVisible(false);
      } else {
        Alert.alert("Error", "Error al agregar vehículo");
      }

    } catch (error) {
      console.error('Error during vehicle add:', error);
      Alert.alert("Error", "Error al agregar vehículo");
    }
  };

  const handleSetMainVehicle = async (id: string) => {

    const response = await setActiveVehicle(id);
    if (response) {
      Alert.alert("Éxito", "Vehículo establecido como principal");
      await loadRoleAndVehicles();
    } else {
      Alert.alert("Error", "Error al establecer vehículo como principal");
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    const isPrincipal = vehicles.find(v => v.id === id)?.principal;
    if (isPrincipal) {
      Alert.alert("Error", "No puedes eliminar el vehículo principal");
      return;
    }
    const response = await deleteVehicleApi(id);
    if (response) {
      Alert.alert("Éxito", "Vehículo eliminado correctamente");
      await loadRoleAndVehicles();
    } else {
      Alert.alert("Error", "Error al eliminar vehículo");
    }
  };

  const getUserInfo = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      const response = await getUserInfoApi(token)
      setUser(response);
    }
  }

  const handleLogout = () => {
    logout();
    alert("Sesión cerrada");
  }

  const handleSupport = () => {
    const url = "https://wa.me/+593995580333/?text=Hola%20necesito%20soporte%20con%20mi%20app%20CityGo";
    Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.imageContainer}>
          <Ionicons name="person-circle-outline" size={120} color="#1D4ED8" />
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>{user?.telefono}</Text>
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
        {role === Roles.DRIVER && (
          <MenuOption icon="car-outline" title="Mis Vehículos" onPress={() => setIsVehiclesModalVisible(true)} />
        )}
        <MenuOption icon="time-outline" title="Historial de viajes" />
        <MenuOption icon="card-outline" title="Métodos de pago" />
        <MenuOption icon="notifications-outline" title="Notificaciones" />
        <MenuOption icon="help-circle-outline" title="Soporte técnico" onPress={handleSupport} />
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Vehículos */}
      <Modal visible={isVehiclesModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mis Vehículos</Text>
              <TouchableOpacity onPress={() => setIsVehiclesModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {vehicles && vehicles.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleCard, v.principal && styles.mainVehicleCard]}
                  onPress={() => handleSetMainVehicle(v.id)}
                >
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{v.brand} {v.model}</Text>
                    <Text style={styles.vehicleDetails}>Placa: {v.plate} • Color: {v.color}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <Ionicons
                      name={v.principal ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={v.principal ? "#1D4ED8" : "#9CA3AF"}
                    />
                    <TouchableOpacity onPress={() => {
                      Alert.alert(
                        "Eliminar Vehículo",
                        "¿Estás seguro de que deseas eliminar este vehículo?",
                        [
                          { text: "Cancelar", style: "cancel" },
                          { text: "Eliminar", style: "destructive", onPress: () => handleDeleteVehicle(v.id) }
                        ]
                      );
                    }}>
                      <Ionicons name="trash-outline" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
              {vehicles.length === 0 && (
                <Text style={styles.emptyText}>No tienes vehículos registrados.</Text>
              )}
            </ScrollView>

            {vehicles.length < 3 && (
              <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setIsAddVehicleModalVisible(true)}>
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.addVehicleText}>Agregar Vehículo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Agregar Vehículo */}
      <Modal visible={isAddVehicleModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo Vehículo</Text>
              <TouchableOpacity onPress={() => setIsAddVehicleModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Marca (ej. Toyota)"
              placeholderTextColor="#9CA3AF"
              value={newVehicle.marca}
              autoCapitalize="characters"
              onChangeText={(t) => setNewVehicle({ ...newVehicle, marca: t.toUpperCase() })}
            />
            <TextInput
              style={styles.input}
              placeholder="Modelo (ej. Corolla 2024)"
              placeholderTextColor="#9CA3AF"
              value={newVehicle.modelo}
              autoCapitalize="characters"
              onChangeText={(t) => setNewVehicle({ ...newVehicle, modelo: t.toUpperCase() })}
            />
            <TextInput
              style={styles.input}
              placeholder="Placa (ej. ABC1234)"
              placeholderTextColor="#9CA3AF"
              value={newVehicle.placa}
              autoCapitalize="characters"
              onChangeText={(t) => setNewVehicle({ ...newVehicle, placa: t.toUpperCase() })}
            />
            <TextInput
              style={styles.input}
              placeholder="Color (ej. Blanco)"
              placeholderTextColor="#9CA3AF"
              value={newVehicle.color}
              autoCapitalize="characters"
              onChangeText={(t) => setNewVehicle({ ...newVehicle, color: t.toUpperCase() })}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVehicle}>
              <Text style={styles.saveBtnText}>Guardar Vehículo</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

function MenuOption({ icon, title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress}>
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
  logoutText: { color: '#EF4444', fontWeight: 'bold' },

  // Modals Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 20, width: '90%', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },

  vehicleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 15, borderRadius: 10, width: '100%', marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  mainVehicleCard: { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 16, fontWeight: 'bold', color: '#1E3A8A' },
  vehicleDetails: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 20 },

  addVehicleBtn: { flexDirection: 'row', backgroundColor: '#1D4ED8', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 10 },
  addVehicleText: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },

  input: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 15, marginBottom: 10, fontSize: 16 },
  saveBtn: { backgroundColor: '#1D4ED8', padding: 15, borderRadius: 12, alignItems: 'center', width: '100%', marginTop: 10 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});