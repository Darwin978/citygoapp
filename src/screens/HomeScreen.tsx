import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';

const { width, height } = Dimensions.get('window');
// REEMPLAZA CON TU GOOGLE MAPS API KEY
const GOOGLE_MAPS_APIKEY = 'AIzaSyBfVCCME9FaQG7zUd0xbeAQDehrYnFrpZA'; 

export default function HomeScreen() {
  const { login, aproveed } = useAuth()
  const [region, setRegion] = useState<any>(null);
  const [status, setStatus] = useState<'IDLE' | 'PICKUP' | 'DESTINATION' | 'ROUTE'>('IDLE');
  
  // Coordenadas de los puntos
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [destinationCoords, setDestinationCoords] = useState<any>(null);
  
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      const initialRegion = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(initialRegion);
    })();
  }, []);

  // Función al pulsar el botón principal
  const handleAction = () => {
    if (status === 'IDLE') {
      setStatus('PICKUP');
    } else if (status === 'PICKUP') {
      setPickupCoords({ latitude: region.latitude, longitude: region.longitude });
      setStatus('DESTINATION');
    } else if (status === 'DESTINATION') {
      setDestinationCoords({ latitude: region.latitude, longitude: region.longitude });
      setStatus('ROUTE');
    }
  };

  const resetFlow = () => {
    setStatus('IDLE');
    setPickupCoords(null);
    setDestinationCoords(null);
  };

  if (!region) return <ActivityIndicator style={{flex:1}} size="large" color="#1D4ED8" />;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(reg) => setRegion(reg)}
        showsUserLocation={true}
      >
        {/* Marcadores Estáticos (Solo aparecen cuando ya fueron confirmados) */}
        {pickupCoords && status !== 'PICKUP' && (
          <Marker coordinate={pickupCoords} title="Recogida">
            <Ionicons name="location" size={40} color="#1D4ED8" />
          </Marker>
        )}
        
        {destinationCoords && status === 'ROUTE' && (
          <Marker coordinate={destinationCoords} title="Destino">
            <Ionicons name="location" size={40} color="#EF4444" />
          </Marker>
        )}

        {/* TRAZADO DE RUTA REAL */}
        {status === 'ROUTE' && pickupCoords && destinationCoords && (
          <MapViewDirections
            origin={pickupCoords}
            destination={destinationCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#1D4ED8"
            onReady={result => {
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
              });
            }}
          />
        )}
      </MapView>

      {/* PIN FIJO CENTRAL (Solo durante selección) */}
      {(status === 'PICKUP' || status === 'DESTINATION') && (
        <View style={styles.markerFixed} pointerEvents="none">
          <View style={[styles.markerLabel, { backgroundColor: status === 'PICKUP' ? '#1D4ED8' : '#EF4444' }]}>
            <Text style={styles.markerLabelText}>
              {status === 'PICKUP' ? 'Punto de partida' : 'Punto de destino'}
            </Text>
          </View>
          <Ionicons 
            name="location" 
            size={50} 
            color={status === 'PICKUP' ? "#1D4ED8" : "#EF4444"} 
          />
        </View>
      )}

      {/* INTERFAZ DE USUARIO INFERIOR */}
      <View style={styles.bottomContainer}>
        {status === 'ROUTE' ? (
          <View style={styles.confirmCard}>
            <Text style={styles.routeInfoTitle}>Viaje Sugerido</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>$3.50</Text>
              <Text style={styles.timeText}>10-15 min</Text>
            </View>
            <TouchableOpacity style={styles.btnConfirm} onPress={() => Alert.alert("CityGo", "Buscando conductor...")}>
              <Text style={styles.btnText}>Solicitar CityGo Now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resetFlow} style={styles.btnCancel}>
              <Text style={styles.btnCancelText}>Cambiar ruta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.mainActionBtn} onPress={handleAction}>
            <Text style={styles.mainActionText}>
              {status === 'IDLE' && "Solicitar un Go"}
              {status === 'PICKUP' && "Confirmar recogida aquí"}
              {status === 'DESTINATION' && "Confirmar destino aquí"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  
  // Pin Fijo en el Centro del Mapa
  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -25,
    marginTop: -55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLabel: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  markerLabelText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  // Botones y Tarjetas
  bottomContainer: { position: 'absolute', bottom: 40, width: '100%', paddingHorizontal: 20 },
  mainActionBtn: { 
    backgroundColor: '#1D4ED8', 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center', 
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10
  },
  mainActionText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  confirmCard: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 30,
    elevation: 20,
    shadowColor: '#000',
  },
  routeInfoTitle: { fontSize: 14, color: '#6B7280', fontWeight: 'bold', marginBottom: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  priceText: { fontSize: 32, fontWeight: '900', color: '#10B981' },
  timeText: { fontSize: 16, color: '#1E3A8A', fontWeight: '600' },
  btnConfirm: { backgroundColor: '#1D4ED8', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnCancel: { marginTop: 15, alignItems: 'center' },
  btnCancelText: { color: '#EF4444', fontWeight: 'bold' }
});