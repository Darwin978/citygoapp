import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Switch, TouchableOpacity, Alert, Modal } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// --- TIPOS ---
interface RideRequest {
  id: string;
  clientName: string;
  origin: string;
  distance: string;
  price: string;
  lat: number;
  lng: number;
}

// --- MOCKS ---
const MOCK_RIDE_REQUEST: RideRequest = {
  id: 'pasajero-1',
  clientName: 'María García',
  origin: 'Parque Calderón, Cuenca',
  distance: '2.5 km',
  price: '$3.50',
  lat: -2.9020,
  lng: -78.9950
};

export default function HomeScreen({ route }: any) {
  // 1. Estados de Usuario y Rol
  const userRole = route.params?.role || 'CLIENT';
  const userName = route.params?.name || 'Usuario CityGo';
  const [isDriverActive, setIsDriverActive] = useState(true);

  // 2. Estados de Carreras
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
  const [ridesList, setRidesList] = useState<RideRequest[]>([]);

  // 3. Simulación inicial (Solo para demo)
  useEffect(() => {
    if (userRole === 'DRIVER' && isDriverActive) {
      const timer = setTimeout(() => {
        // Al llegar la carrera, la ponemos en la lista (globo) y en el modal
        setRidesList([MOCK_RIDE_REQUEST]);
        setSelectedRide(MOCK_RIDE_REQUEST);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isDriverActive, userRole]);

  // 4. Lógica de Notificaciones Reales
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      if (data && data.id) {
        const newRide: RideRequest = {
          id: data.id,
          clientName: data.clientName || 'Cliente Nuevo',
          origin: data.origin || 'Ubicación cercana',
          distance: data.distance || 'A pocos km',
          price: data.price || '$0.00',
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
        };
        setRidesList(prev => [...prev, newRide]);
        if (isDriverActive) setSelectedRide(newRide);
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data) setSelectedRide(data);
    });

    return () => {
    notificationListener.remove(); // Se usa el método del objeto retornado
    responseListener.remove();     // Se usa el método del objeto retornado
  };
  }, [isDriverActive]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: -2.9001,
          longitude: -79.0059,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {/* Renderizado de Globos (Markers) en el mapa */}
        {isDriverActive && userRole === 'DRIVER' && ridesList.map((ride) => (
          <Marker 
            key={ride.id}
            coordinate={{ latitude: ride.lat, longitude: ride.lng }}
            onPress={() => setSelectedRide(ride)}
          >
            <View style={styles.customMarker}>
              <View style={styles.markerBubble}>
                <Text style={styles.markerPriceText}>{ride.price}</Text>
              </View>
              <View style={styles.markerArrow} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* OVERLAY SUPERIOR: Switch de Conductor */}
      <View style={styles.topContainer}>
        {userRole === 'DRIVER' ? (
          <View style={[styles.statusCard, isDriverActive ? styles.activeCard : styles.inactiveCard]}>
            <View>
              <Text style={styles.statusLabel}>{isDriverActive ? "EN LÍNEA" : "MODO PASAJERO"}</Text>
              <Text style={styles.driverName}>{userName}</Text>
            </View>
            <Switch
              value={isDriverActive}
              onValueChange={setIsDriverActive}
              trackColor={{ false: "#9CA3AF", true: "#34D399" }}
            />
          </View>
        ) : (
          <View style={styles.clientHeader}>
            <Ionicons name="search" size={20} color="#1D4ED8" />
            <Text style={styles.clientHeaderText}>¿A dónde vamos hoy?</Text>
          </View>
        )}
      </View>

      {/* OVERLAY INFERIOR: Botón Solicitar */}
      <View style={styles.bottomContainer}>
        {(!isDriverActive || userRole === 'CLIENT') && (
          <TouchableOpacity style={styles.btnRequest}>
            <Text style={styles.btnRequestText}>Solicitar Unidad</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* MODAL / DIÁLOGO DE CARRERA (Aparece al recibir notificación o tocar globo) */}
      <Modal 
        visible={selectedRide !== null} 
        transparent 
        animationType="slide"
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rideCard}>
            <View style={styles.rideHeader}>
              <Text style={styles.newRideTitle}>NUEVA SOLICITUD</Text>
              <Text style={styles.ridePrice}>{selectedRide?.price}</Text>
            </View>
            
            <View style={styles.rideInfo}>
              <Ionicons name="person-circle" size={45} color="#1D4ED8" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.clientName}>{selectedRide?.clientName}</Text>
                <Text style={styles.rideDistance}>A {selectedRide?.distance} de ti</Text>
              </View>
            </View>

            <View style={styles.locationBox}>
              <Text style={styles.originText}>📍 {selectedRide?.origin}</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.btnDecline} 
                onPress={() => setSelectedRide(null)}
              >
                <Text style={styles.btnDeclineText}>Ignorar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.btnAccept} 
                onPress={() => {
                  Alert.alert("¡Éxito!", "Has aceptado el viaje. Dirígete al punto de recogida.");
                  setSelectedRide(null);
                }}
              >
                <Text style={styles.btnAcceptText}>Aceptar Carrera</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  
  // Estilos de Marcador Personalizado (Globos)
  customMarker: { alignItems: 'center' },
  markerBubble: { backgroundColor: '#1D4ED8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'white' },
  markerPriceText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  markerArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#1D4ED8', marginTop: -1 },

  topContainer: { position: 'absolute', top: 60, left: 20, right: 20 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 15, elevation: 10, alignItems: 'center' },
  activeCard: { backgroundColor: '#1D4ED8' },
  inactiveCard: { backgroundColor: '#4B5563' },
  statusLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 'bold' },
  driverName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  clientHeader: { backgroundColor: 'white', padding: 15, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 5 },
  clientHeaderText: { marginLeft: 10, color: '#4B5563', fontWeight: '500' },
  
  bottomContainer: { position: 'absolute', bottom: 40, left: 20, right: 20 },
  btnRequest: { backgroundColor: '#1D4ED8', padding: 18, borderRadius: 15, alignItems: 'center', elevation: 5 },
  btnRequestText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  
  // Modal de Carrera
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  rideCard: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  newRideTitle: { color: '#1D4ED8', fontWeight: 'bold', fontSize: 14 },
  ridePrice: { fontSize: 26, fontWeight: 'bold', color: '#10B981' },
  rideInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  clientName: { fontSize: 18, fontWeight: 'bold' },
  rideDistance: { color: '#6B7280' },
  locationBox: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 10, marginBottom: 25 },
  originText: { color: '#374151', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  btnDecline: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EF4444', alignItems: 'center' },
  btnDeclineText: { color: '#EF4444', fontWeight: 'bold' },
  btnAccept: { flex: 2, padding: 16, backgroundColor: '#1D4ED8', borderRadius: 12, alignItems: 'center' },
  btnAcceptText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});