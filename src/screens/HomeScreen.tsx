import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Switch, Image, Platform } from 'react-native';
import MapView, { Marker, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';
import AsyncStorage from "@react-native-async-storage/async-storage";
import CarIcon from '../../assets/car_icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Roles } from '../../utils/services/rolesEnum';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import io from 'socket.io-client';
import { BACKEND_URL } from '../../utils/services/apiConfig';
import { getPriceApi } from '../../utils/services/ridesServices';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBfVCCME9FaQG7zUd0xbeAQDehrYnFrpZA';
const SOCKET_URL = 'http://' + BACKEND_URL + ':3000'; // Tu backend NestJS

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'PICKUP' | 'DESTINATION' | 'ROUTE' | 'SEARCHING' | 'ON_RIDE'>('PICKUP');
  const [role, setRole] = useState<string | null>(null);
  const [routeDetails, setRouteDetails] = useState<any>(null);
  const [price, setPrice] = useState<number>(0);
  const [distance, setDistance] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');

  // Coordenadas
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [destinationCoords, setDestinationCoords] = useState<any>(null);

  // Sockets y Seguimiento
  const socket = useRef<any>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  // Animación del conductor (Para el cliente)
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [animatedDriverCoords] = useState(new AnimatedRegion({
    latitude: -2.8974, // Coordenadas iniciales de Cuenca por defecto
    longitude: -79.0045,
    latitudeDelta: 0,
    longitudeDelta: 0,
  }));

  const mapRef = useRef<MapView>(null);
  const pickupSearchRef = useRef<any>(null);
  const destinationSearchRef = useRef<any>(null);

  // 1. Inicializar Sockets
  useEffect(() => {
    socket.current = io(SOCKET_URL);

    socket.current.on('locationUpdated', (newCoords: any) => {
      // Animación suave del coche
      if (Platform.OS === 'android') {
        animatedDriverCoords.timing({
          ...newCoords,
          duration: 1000,
          useNativeDriver: false
        }).start();
      } else {
        setDriverLocation(newCoords);
      }
    });

    return () => socket.current.disconnect();
  }, []);

  // 2. Obtener ubicación inicial y Rol
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      getAddressFromCoords(loc.coords.latitude, loc.coords.longitude, true);
      const savedRole = await AsyncStorage.getItem('role');
      setRole(savedRole);
    })();
  }, []);

  // 3. Lógica del Conductor: Enviar ubicación
  useEffect(() => {
    let locationWatcher: any;
    if (role === Roles.DRIVER && isOnline) {
      (async () => {
        locationWatcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5 },
          (location) => {
            const coords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              heading: location.coords.heading,
            };
            socket.current.emit('updateLocation', { rideId: currentRideId, coords });
          }
        );
      })();
    }
    return () => locationWatcher?.remove();
  }, [isOnline, currentRideId]);

  // --- FUNCIONES DE APOYO ---

  const handleAction = async () => {
    if (status === 'IDLE' || status === 'PICKUP') {
      const coords = { latitude: region.latitude, longitude: region.longitude };
      setPickupCoords(coords);
      getAddressFromCoords(coords.latitude, coords.longitude, true);
      setStatus('DESTINATION');
    } else if (status === 'DESTINATION') {
      const coords = { latitude: region.latitude, longitude: region.longitude };
      await setDestinationCoords(coords);
      await getAddressFromCoords(coords.latitude, coords.longitude, false);
      await getPrice(coords);
    }
  };

  const getAddressFromCoords = async (lat: number, lng: number, isPickup: boolean) => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_APIKEY}`);
      const data = await res.json();
      if (data.results[0]) {
        const addr = data.results[0].formatted_address;
        isPickup ? pickupSearchRef.current?.setAddressText(addr) : destinationSearchRef.current?.setAddressText(addr);
      }
    } catch (e) { console.error(e); }
  };

  const moveToLocation = (details: any, isPickup: boolean) => {
    const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
    if (isPickup) {
      setPickupCoords(coords);
      setStatus('DESTINATION');
    } else {
      setDestinationCoords(coords);
      if (!pickupCoords) {
        const currentCoords = { latitude: region.latitude, longitude: region.longitude };
        setPickupCoords(currentCoords);
        getAddressFromCoords(currentCoords.latitude, currentCoords.longitude, true);
      }
      setStatus('ROUTE');
    }
    mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
  };

  const centerOnUserLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } catch (e) {
      console.warn("Could not get user location", e);
    }
  };

  const getPrice = async (destinationCoords: { latitude: number, longitude: number }) => {
    try {
      const price = await getPriceApi(pickupCoords.latitude, pickupCoords.longitude, destinationCoords.latitude, destinationCoords.longitude);
      setPrice(price.total);
      setDistance(price.distance);
      setTime(price.duration);
      setError(null);
      setStatus('ROUTE');

    } catch (e) {
      setPrice(0);
      setDistance(0);
      setTime(0);
      setError("TUVIMOS UN PROBLEMA AL OBTENER EL PRECIO, PERO EL CONDUCTOR TE DARA SU MEJOR TARIFA SI DECIDES CONTINUAR!");
      console.warn("Could not get price", e);
      setStatus('ROUTE');
    }
  };

  const handleCancelTrip = async () => {
    try {
      Alert.alert('CityGo', '¿Estás seguro de cancelar el viaje?');
      //const response = await cancelTripApi(id);
      console.log("Viaje cancelado:");
      setStatus('ROUTE');
    } catch (e) {
      console.error(e);
    }
  };



  if (!region || !role) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1D4ED8" />;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={(reg, details) => {
          setRegion(reg);
          if (details?.isGesture) {
            if (status === 'PICKUP' || status === 'IDLE') {
              getAddressFromCoords(reg.latitude, reg.longitude, true);
            } else if (status === 'DESTINATION') {
              getAddressFromCoords(reg.latitude, reg.longitude, false);
            }
          }
        }}
      >
        {/* Marcador del Conductor Animado (Para el Cliente) */}
        {role === Roles.USER && (
          <Marker.Animated
            coordinate={animatedDriverCoords as any}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ transform: [{ rotate: `${driverLocation?.heading || 0}deg` }] }}>
              <Image source={CarIcon} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>
          </Marker.Animated>
        )}

        {/* Puntos de Ruta */}
        {pickupCoords && <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#1D4ED8" /></Marker>}
        {destinationCoords && <Marker coordinate={destinationCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#EF4444" /></Marker>}

        {status === 'ROUTE' && pickupCoords && destinationCoords && (
          <MapViewDirections
            origin={pickupCoords}
            destination={destinationCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#1D4ED8"
            onReady={res => {
              setRouteDetails(res);
              mapRef.current?.fitToCoordinates(res.coordinates, { edgePadding: { top: 100, right: 50, bottom: 300, left: 50 } });
            }}
          />
        )}
      </MapView>

      {/* Buscadores Flotantes */}
      {status !== 'ROUTE' && status !== 'ON_RIDE' && status !== 'SEARCHING' && (
        <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
          <GooglePlacesAutocomplete
            ref={pickupSearchRef}
            placeholder="¿Recogida?"
            fetchDetails={true}
            onPress={(data, details) => moveToLocation(details, true)}
            query={{ key: GOOGLE_MAPS_APIKEY, language: 'es', components: 'country:ec' }}
            styles={{
              container: { flex: 0, width: '100%', marginBottom: 10, zIndex: 2 },
              listView: { backgroundColor: 'white', borderRadius: 10, elevation: 5 },
              textInput: styles.searchInput,
              row: { padding: 13, height: 44, flexDirection: 'row' },
            }}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            listUnderlayColor="#f0f0f0"
            textInputProps={{ placeholderTextColor: '#6B7280' }}
          />
          <GooglePlacesAutocomplete
            ref={destinationSearchRef}
            placeholder="¿Destino?"
            fetchDetails={true}
            onPress={(data, details) => moveToLocation(details, false)}
            query={{ key: GOOGLE_MAPS_APIKEY, language: 'es', components: 'country:ec' }}
            styles={{
              container: { flex: 0, width: '100%', zIndex: 1 },
              listView: { backgroundColor: 'white', borderRadius: 10, elevation: 5 },
              textInput: styles.searchInput,
              row: { padding: 13, height: 44, flexDirection: 'row' },
            }}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            listUnderlayColor="#f0f0f0"
            textInputProps={{ placeholderTextColor: '#6B7280' }}
          />
        </View>
      )}

      {/* Pin Fijo Central */}
      {(status === 'PICKUP' || status === 'DESTINATION' || status === 'IDLE') && (
        <View style={styles.markerFixed} pointerEvents="none">
          <Ionicons name="location" size={50} color={status === 'DESTINATION' ? "#EF4444" : "#1D4ED8"} />
        </View>
      )}

      {/* Botón de Mi Ubicación */}
      {status !== 'ROUTE' && status !== 'ON_RIDE' && status !== 'SEARCHING' && (
        <TouchableOpacity
          style={[styles.myLocationBtn, { bottom: insets.bottom + 100 }]}
          onPress={centerOnUserLocation}
        >
          <Ionicons name="locate" size={26} color="#1D4ED8" />
        </TouchableOpacity>
      )}

      {/* Botón de Acción Principal / Card de Precio */}
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 20 }]}>
        {status === 'SEARCHING' ? (
          <View style={styles.searchingCard}>
            <ActivityIndicator size="large" color="#1D4ED8" style={{ marginBottom: 15 }} />
            <Text style={styles.searchingTitle}>Buscando conductor...</Text>
            <Text style={styles.searchingSubtext}>Notificando a los conductores cercanos a tu punto de recogida.</Text>
            <TouchableOpacity
              style={styles.btnCancelSearch}
              onPress={() => handleCancelTrip()}
            >
              <Text style={styles.btnCancelSearchText}>Cancelar viaje GO!</Text>
            </TouchableOpacity>
          </View>
        ) : status === 'ROUTE' ? (
          <View style={styles.confirmCard}>
            <Text style={styles.priceText}>${price.toFixed(2)}</Text>
            <Text style={styles.distanceText}>{distance}</Text>
            <Text style={styles.timeText}>{error ? error : time}</Text>

            {/* Opciones de Pago */}
            <View style={styles.paymentContainer}>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'CASH' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('CASH')}
              >
                <Ionicons name="cash-outline" size={20} color={paymentMethod === 'CASH' ? 'white' : '#1D4ED8'} />
                <Text style={[styles.paymentText, paymentMethod === 'CASH' && styles.paymentTextActive]}>Efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentBtn, paymentMethod === 'CARD' && styles.paymentBtnActive]}
                onPress={() => setPaymentMethod('CARD')}
              >
                <Ionicons name="card-outline" size={20} color={paymentMethod === 'CARD' ? 'white' : '#1D4ED8'} />
                <Text style={[styles.paymentText, paymentMethod === 'CARD' && styles.paymentTextActive]}>Tarjeta</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnConfirm} onPress={() => setStatus('SEARCHING')}>
              <Text style={styles.btnText}>Confirmar Viaje</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={() => {
                setStatus('PICKUP');
                setDestinationCoords(null);
                setRouteDetails(null);
                destinationSearchRef.current?.setAddressText('');
              }}
            >
              <Text style={styles.btnCancelText}>Cambiar Ruta / Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          role === Roles.USER && (
            <TouchableOpacity style={styles.mainActionBtn} onPress={handleAction}>
              <Text style={styles.mainActionText}>
                {(status === 'IDLE' || status === 'PICKUP') ? 'Confirmar Recogida' : 'Confirmar Destino'}
              </Text>
            </TouchableOpacity>
          )
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
    marginTop: -50,
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

  myLocationBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 10,
  },

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
  timeText: { fontSize: 15, color: '#1E3A8A', fontWeight: '600' },
  distanceText: { fontSize: 15, color: '#1E3A8A', fontWeight: '600' },

  paymentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
    gap: 10,
  },
  paymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    borderRadius: 10,
    gap: 8,
  },
  paymentBtnActive: {
    backgroundColor: '#1D4ED8',
  },
  paymentText: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  paymentTextActive: {
    color: 'white',
  },

  searchingCard: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 30,
    elevation: 20,
    shadowColor: '#000',
    alignItems: 'center',
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 10,
  },
  searchingSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  btnCancelSearch: {
    padding: 15,
    backgroundColor: '#FEE2E2',
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
  },
  btnCancelSearchText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 16,
  },

  btnConfirm: { backgroundColor: '#1D4ED8', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  btnCancel: { marginTop: 15, alignItems: 'center' },
  btnCancelText: { color: '#EF4444', fontWeight: 'bold' },
  driverInterface: {
    position: 'absolute',
    top: 20,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
    elevation: 10,
    justifyContent: 'space-between',
    width: '80%'
  },
  statusText: { fontWeight: 'bold', fontSize: 16, color: '#1E3A8A' },
  waitingDriveCard: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15
  },
  waitingDriverText: { color: '#1D4ED8', fontWeight: '600' },
  carMarkerContainer: {
    // Puedes añadir una sombra o un fondo sutil si el ícono no resalta
    // backgroundColor: 'rgba(255,255,255,0.7)',
    // padding: 5,
    // borderRadius: 20,
  },
  carIconStyle: {
    width: 40, // Ajusta según el tamaño de tu imagen
    height: 40,
    // tintColor: '#1D4ED8', // Opcional: si quieres teñir un PNG blanco/negro con tu color
  },
  distanceSubtext: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  arrivalText: { color: '#9CA3AF', fontSize: 12 },
  searchContainer: {
    position: 'absolute',
    width: '90%',
    alignSelf: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 1000, // IMPORTANTE: Debe estar por encima del mapa
  },
  searchInput: {
    height: 45,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#374151',
  },
});