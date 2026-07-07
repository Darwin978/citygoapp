import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Linking, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserInfoApi, getUserStatsApi } from '../../utils/services/userService';
import { Roles } from '../../utils/services/rolesEnum';
import { addVehicleApi, deleteVehicleApi, getUserVehicles, setActiveVehicle } from '../../utils/services/vehicleService';
import { useCustomAlert } from '../../utils/context/AlertContext';
import { getAvailableRidesApi } from '../../utils/services/ridesServices';
import { BACKEND_URL } from '../../utils/services/apiConfig';

export default function ProfileScreen() {
  const { showAlert } = useCustomAlert();
  const { logout } = useAuth();
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isVehiclesModalVisible, setIsVehiclesModalVisible] = useState(false);
  const [isAddVehicleModalVisible, setIsAddVehicleModalVisible] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ marca: '', modelo: '', placa: '', color: '' });

  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const fetchAvailableRides = async () => {
    try {
      setLoadingAvailable(true);
      const data = await getAvailableRidesApi();
      setAvailableRides(data || []);
    } catch (error) {
      console.log('Error loading available rides:', error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/ride/${rideId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || result?.status !== 'success') {
        showAlert('Error', result?.message || 'No se pudo aceptar la carrera. Es posible que ya haya sido tomada.');
        fetchAvailableRides();
        return;
      }

      await AsyncStorage.setItem('activeRideId', rideId);
      showAlert('Viaje Asignado', 'Has aceptado la carrera con éxito. Dirígete a la pestaña del Mapa para ver los detalles.');
      fetchAvailableRides();
      navigation.navigate('Mapa');
    } catch (e) {
      console.error(e);
      showAlert('Error', 'Hubo un error al intentar aceptar la carrera.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      getUserInfo(); // Cargar inmediatamente al entrar a la pestaña
      getUserStats();
      loadRoleAndVehicles();
      AsyncStorage.getItem('role').then((savedRole) => {
        if (savedRole === Roles.DRIVER) {
          fetchAvailableRides();
        }
      });
      const interval = setInterval(() => {
        getUserInfo();
        getUserStats();
        loadRoleAndVehicles();
        AsyncStorage.getItem('role').then((savedRole) => {
          if (savedRole === Roles.DRIVER) {
            fetchAvailableRides();
          }
        });
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
      showAlert("Error", "Por favor llena todos los campos");
      return;
    }
    if (vehicles.length >= 3) {
      showAlert("Límite alcanzado", "No puedes agregar más de 3 vehículos");
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
        showAlert("Éxito", "Vehículo agregado correctamente");
        await loadRoleAndVehicles();
        setNewVehicle({ marca: '', modelo: '', placa: '', color: '' });
        setIsAddVehicleModalVisible(false);
      } else {
        showAlert("Error", "Error al agregar vehículo");
      }

    } catch (error) {
      console.error('Error during vehicle add:', error);
      showAlert("Error", "Error al agregar vehículo");
    }
  };

  const handleSetMainVehicle = async (id: string) => {

    const response = await setActiveVehicle(id);
    if (response) {
      showAlert("Éxito", "Vehículo establecido como principal");
      await loadRoleAndVehicles();
    } else {
      showAlert("Error", "Error al establecer vehículo como principal");
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    const isPrincipal = vehicles.find(v => v.id === id)?.principal;
    if (isPrincipal) {
      showAlert("Error", "No puedes eliminar el vehículo principal");
      return;
    }
    const response = await deleteVehicleApi(id);
    if (response) {
      showAlert("Éxito", "Vehículo eliminado correctamente");
      await loadRoleAndVehicles();
    } else {
      showAlert("Error", "Error al eliminar vehículo");
    }
  };

  const getUserInfo = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      const response = await getUserInfoApi(token)
      setUser(response);
    }
  }

  const getUserStats = async () => {
    try {
      const response = await getUserStatsApi();
      setStats(response);
    } catch (error) {
      console.log('Error loading profile stats', error);
    }
  }

  const handleLogout = () => {
    logout();
    showAlert("Éxito", "Sesión cerrada");
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

      {role === Roles.DRIVER ? (
        <>
          <View style={styles.statsRow}>
            <StatItem value={formatNumber(stats?.rating)} label="Calificación" />
            <StatItem value={stats?.completedRides ?? 0} label="Carreras" bordered />
            <StatItem value={formatMoney(stats?.pendingCardPayoutAmount)} label="Por cobrar" />
          </View>
          <View style={styles.insightGrid}>
            <InsightCard icon="card-outline" label="Tarjeta pendientes" value={`${stats?.pendingCardPayoutCount ?? 0} carreras`} accent="#F59E0B" />
            <InsightCard icon="cash-outline" label="Efectivo cobrado" value={formatMoney(stats?.cashPaidAmount)} accent="#10B981" />
            <InsightCard icon="trending-up-outline" label="Promedio por carrera" value={formatMoney(stats?.averageRideValue)} accent="#1D4ED8" />
            <InsightCard icon="close-circle-outline" label="Canceladas" value={stats?.cancelledRides ?? 0} accent="#EF4444" />
          </View>
          <ProfileSection title="Carreras Disponibles para Tomar">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Visualiza y acepta viajes pendientes.</Text>
              <TouchableOpacity onPress={fetchAvailableRides} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="refresh" size={16} color="#1D4ED8" />
                <Text style={{ color: '#1D4ED8', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Actualizar</Text>
              </TouchableOpacity>
            </View>
            
            {loadingAvailable && availableRides.length === 0 ? (
              <ActivityIndicator size="small" color="#1D4ED8" style={{ marginVertical: 10 }} />
            ) : availableRides.length === 0 ? (
              <Text style={styles.emptyText}>No hay carreras disponibles en este momento.</Text>
            ) : (
              availableRides.map((ride) => (
                <View key={ride.tripId} style={styles.availableRideCard}>
                  <View style={styles.rideTop}>
                    <Text style={styles.ridePrice}>{formatMoney(ride.price)}</Text>
                    <Text style={styles.rideTime}>{new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.rideRoute} numberOfLines={1}>{ride.originAddress}</Text>
                  <Text style={styles.rideDestination} numberOfLines={1}>{ride.destinationAddress}</Text>
                  {ride.reference ? (
                    <Text style={styles.rideReference} numberOfLines={1}>Ref: {ride.reference}</Text>
                  ) : null}
                  <TouchableOpacity 
                    style={styles.acceptRideBtn} 
                    onPress={() => handleAcceptRide(ride.tripId)}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                    <Text style={styles.acceptRideBtnText}>Aceptar Viaje</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ProfileSection>

          <ProfileSection title="Carreras con tarjeta por cobrar">
            <RideList rides={stats?.pendingCardPayouts || []} emptyText="No tienes carreras pendientes por cobrar." />
          </ProfileSection>
          <ProfileSection title="Historial reciente">
            <RideList rides={stats?.recentRides || []} emptyText="Aún no tienes carreras registradas." />
          </ProfileSection>
        </>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatItem value={stats?.completedRides ?? 0} label="Carreras" />
            <StatItem value={formatMoney(stats?.averageRideValue)} label="Costo medio" bordered />
            <StatItem value={stats?.cancelledRides ?? 0} label="Canceladas" />
          </View>
          <View style={styles.insightGrid}>
            <InsightCard icon="star-outline" label="Tu reputación" value={formatNumber(stats?.passengerRating)} accent="#F59E0B" />
            <InsightCard icon="wallet-outline" label="Total gastado" value={formatMoney(stats?.totalSpent)} accent="#1D4ED8" />
            <InsightCard icon="card-outline" label="Pagado con tarjeta" value={formatMoney(stats?.cardPaymentsAmount)} accent="#7C3AED" />
            <InsightCard icon="cash-outline" label="Pagado en efectivo" value={formatMoney(stats?.cashPaymentsAmount)} accent="#10B981" />
          </View>
          <ProfileSection title="Historial de pagos">
            <RideList rides={stats?.paymentHistory || []} emptyText="Aún no tienes pagos registrados." />
          </ProfileSection>
          <ProfileSection title="Viajes recientes">
            <RideList rides={stats?.recentRides || []} emptyText="Aún no tienes carreras registradas." />
          </ProfileSection>
        </>
      )}

      <View style={styles.menuSection}>
        {role === Roles.DRIVER && (
          <MenuOption icon="car-outline" title="Mis Vehículos" onPress={() => setIsVehiclesModalVisible(true)} />
        )}
        {/*<MenuOption icon="time-outline" title="Historial de viajes" />*/}
        <MenuOption icon="card-outline" title="Métodos de pago" />
        {/*<MenuOption icon="notifications-outline" title="Notificaciones" />*/}
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
                  style={[styles.vehicleCard, v.activeVehicleId == v.id && styles.mainVehicleCard]}
                  onPress={() => handleSetMainVehicle(v.id)}
                >
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{v.brand} {v.model}</Text>
                    <Text style={styles.vehicleDetails}>Placa: {v.plate} • Color: {v.color}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                    <Ionicons
                      name={v.activeVehicleId == v.id ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={v.activeVehicleId == v.id ? "#1D4ED8" : "#9CA3AF"}
                    />
                    <TouchableOpacity onPress={() => {
                      showAlert(
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

function formatMoney(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatNumber(value: any) {
  return Number(value || 0).toFixed(1);
}

function statusLabel(status?: string) {
  const labels: any = {
    COMPLETED: 'Finalizada',
    TO_RATING: 'Por calificar',
    CANCELLED: 'Cancelada',
    REQUESTED: 'Solicitada',
    ACCEPTED: 'Aceptada',
    IN_PROGRESS: 'En curso',
    DRIVER_ARRIVED: 'Conductor llegó',
  };
  return labels[status || ''] || status || 'Sin estado';
}

function paymentLabel(payment?: any) {
  if (!payment) return 'Sin pago';
  const method = payment.method === 'CARD' ? 'Tarjeta' : 'Efectivo';
  const status: any = {
    PENDING: 'pendiente',
    PAID: 'pagado',
    CANCELLED: 'cancelado',
    FAILED: 'fallido',
    REFUNDED: 'reembolsado',
  };
  return `${method} · ${status[payment.status] || payment.status}`;
}

function StatItem({ value, label, bordered }: any) {
  return (
    <View style={[styles.statItem, bordered && styles.borderLateral]}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLab}>{label}</Text>
    </View>
  );
}

function InsightCard({ icon, label, value, accent }: any) {
  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightIcon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  );
}

function ProfileSection({ title, children }: any) {
  return (
    <View style={styles.profileSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function RideList({ rides, emptyText }: any) {
  if (!rides || rides.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View>
      {rides.slice(0, 5).map((ride: any) => (
        <View key={ride.id} style={styles.rideCard}>
          <View style={styles.rideTop}>
            <Text style={styles.ridePrice}>{formatMoney(ride.finalPrice)}</Text>
            <Text style={styles.rideStatus}>{statusLabel(ride.status)}</Text>
          </View>
          <Text style={styles.rideRoute} numberOfLines={1}>{ride.originAddress}</Text>
          <Text style={styles.rideDestination} numberOfLines={1}>{ride.destinationAddress}</Text>
          <View style={styles.rideMeta}>
            <Text style={styles.rideMetaText}>{paymentLabel(ride.payment)}</Text>
            <Text style={styles.rideMetaText}>{new Date(ride.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
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

  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  insightCard: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EEF2F7' },
  insightIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  insightValue: { fontSize: 17, fontWeight: '800', color: '#111827' },
  insightLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  profileSection: { paddingHorizontal: 20, paddingTop: 22 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1E3A8A', marginBottom: 12 },
  rideCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EEF2F7', marginBottom: 10 },
  rideTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ridePrice: { fontSize: 17, fontWeight: '800', color: '#1D4ED8' },
  rideStatus: { fontSize: 12, fontWeight: '700', color: '#334155', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  rideRoute: { fontSize: 14, fontWeight: '600', color: '#374151' },
  rideDestination: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  rideMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  rideMetaText: { fontSize: 12, color: '#9CA3AF' },

  menuSection: { padding: 20, paddingTop: 12 },
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
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  availableRideCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1D4ED8', marginBottom: 10 },
  rideTime: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  rideReference: { fontSize: 12, color: '#4B5563', marginTop: 4, fontStyle: 'italic' },
  acceptRideBtn: { flexDirection: 'row', backgroundColor: '#10B981', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 6 },
  acceptRideBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});
