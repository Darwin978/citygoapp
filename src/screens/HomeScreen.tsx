import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Switch, Image, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
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
import { cancelSolicitudApi, getPriceApi, requestRideApi } from '../../utils/services/ridesServices';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBfVCCME9FaQG7zUd0xbeAQDehrYnFrpZA';
const SOCKET_URL = BACKEND_URL; // Tu backend NestJS

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
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
  const [loading, setLoading] = useState<boolean>(false);
  const [driverInfo, setDriverInfo] = useState<any>(null);


  // Coordenadas
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [destinationCoords, setDestinationCoords] = useState<any>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [myLocation, setMyLocation] = useState<any>(null);

  // Sockets y Seguimiento
  const socket = useRef<any>(null);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);

  // Solicitudes de Viaje (Conductor)
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState<boolean>(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [activeRequestRide, setActiveRequestRide] = useState<any>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpValidate, setOtpValidate] = useState(false);

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

  async function getUserId() {
    const userId = await AsyncStorage.getItem('userId');
    setUserId(userId);
  }

  useEffect(() => {
    getUserId();
  }, []);

  // 1. Inicializar Sockets
  useEffect(() => {
    // --- EL CAMBIO CLAVE: Pasar el userId ---
    socket.current = io(SOCKET_URL, {
      query: { userId: userId } // Asegúrate de tener el ID del usuario logueado aquí
    });

    socket.current.on('connect', () => {
      console.log("✅ Conectado al servidor de CityGo con ID:", socket.current.id);

      if (role === Roles.DRIVER) {
        console.log("Ingresa a getAvailableRides");
        socket.current.emit('getAvailableRides', (rides: any[]) => {
          setAvailableRequests(rides);
        });
      }
    });

    socket.current.on('newRideRequest', (req: any) => {
      console.log("Nueva solicitud de viaje:", req);
      setAvailableRequests(prevRequests => {
        // Evitar duplicados por si el socket reintenta el envío
        const exists = prevRequests.find(r => r.tripId === req.tripId);
        if (exists) return prevRequests;
        return [...prevRequests, req];
      });

      // Opcional: mostrar el diálogo solo para la más reciente
      setPendingRequest(req);
      setShowRequestDialog(true);
    });

    socket.current.on('trip_accepted', (data: any) => {
      socket.current.emit('joinRide', data.rideId);
      setDriverInfo(data.driver);
      setStatus('ON_RIDE'); // Sugerencia: Usa ACCEPTED antes de ON_RIDE
      Alert.alert("¡Conductor asignado!", `${data.driverName} va en camino.`);
    });

    socket.current.on('locationUpdated', (newCoords: any) => {
      // Asegúrate de que el backend envíe 'latitude' y 'longitude'
      const coords = {
        latitude: newCoords.lat || newCoords.latitude,
        longitude: newCoords.lng || newCoords.longitude,
      };

      if (Platform.OS === 'android') {
        animatedDriverCoords.timing({
          ...coords,
          duration: 2000,
          useNativeDriver: false
        } as any).start();
      } else {
        setDriverLocation(coords);
      }
    });

    socket.current.on('trip_taken', (data: { tripId: string }) => {
      setAvailableRequests(prev => prev.filter(r => r.tripId !== data.tripId));
      if (pendingRequest?.tripId === data.tripId) {
        setShowRequestDialog(false);
        Alert.alert("Viaje no disponible", "Otro conductor ha aceptado esta carrera.");
      }
    });

    socket.current.on('trip_completed_success', async () => {
      // 1. Limpiar persistencia
      await AsyncStorage.removeItem('activeRideId');

      // 2. Resetear estados de la UI
      setCurrentRideId(null);
      setPendingRequest(null);
      setStatus('IDLE'); // O 'PICKUP' según tu enum inicial

      Alert.alert("Viaje Finalizado", "Ya puedes recibir nuevas solicitudes.");
    });

    socket.current.on('ride_finished', async (data: any) => {
      // 1. Limpiar persistencia
      await AsyncStorage.removeItem('activeRideId');

      // 2. Resetear estados
      setCurrentRideId(null);
      setStatus('IDLE');

      // 3. Mostrar resumen (Podrías navegar a una pantalla de Rating/Calificación)
      Alert.alert(
        "¡Llegamos!",
        `${data.finalPrice}`
      );
    });

    return () => {
      if (socket.current) socket.current.disconnect();
    };

  }, [userId]);

  useEffect(() => {
    const restoreSession = async () => {
      console.log("Ingresa a restoreSession");
      const savedRideId = await AsyncStorage.getItem('activeRideId');
      console.log("savedRideId", savedRideId);
      if (savedRideId) {
        // 3. Pedimos al backend el estado REAL de ese viaje
        socket.current.emit('getRideStatus', { rideId: savedRideId }, (response: any) => {
          console.log("response getRideStatus", response);
          if (response.status === 'ACCEPTED' || response.status === 'ON_RIDE' || response.status === 'IN_PROGRESS') {
            // Restauramos los IDs
            setCurrentRideId(savedRideId);

            // Estructuramos el objeto para que el mapa pueda leer las coordenadas (destLat, destLng, etc.)
            setActiveRequestRide({ ride: response.rideData });

            // Simulamos el pendingRequest para que la UI muestre el nombre del pasajero
            setPendingRequest({
              tripId: savedRideId,
              clientName: response.rideData?.client?.name || 'Pasajero',
            });

            // Determinamos si ya recogió al pasajero (OTP validado) o si va en camino
            const isTripInProgress = response.status === 'IN_PROGRESS' || response.status === 'ON_RIDE' || response.rideData?.status === 'IN_PROGRESS';
            setOtpValidate(isTripInProgress);

            // Para el conductor, 'ON_RIDE' activa toda la UI del viaje en curso
            setStatus('ON_RIDE');
          } else {
            // El viaje ya terminó o se canceló mientras la app estaba cerrada
            AsyncStorage.removeItem('activeRideId');
          }
        });
      }
    };
    restoreSession();
  }, [userId])

  // 2. Obtener ubicación inicial y Rol
  useEffect(() => {
    (async () => {
      try {
        console.log("Ingresa a obtener ubicacion");
        const savedRole = await AsyncStorage.getItem('role');
        console.log("ROL", savedRole);
        setRole(savedRole);
        if (savedRole === Roles.DRIVER) {
          setIsOnline(true);
        }
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log("status", status);
        if (status !== 'granted') return;
        let loc = await Location.getCurrentPositionAsync({});
        console.log("posicion actual ", loc);
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setMyLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading || 0,
        });
        getAddressFromCoords(loc.coords.latitude, loc.coords.longitude, true);

      } catch (error) {
        console.log("Error al obtener ubicacion", error);
      }
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
            setMyLocation(coords);
            socket.current.emit('updateLocation', { rideId: currentRideId, coords });
          }
        );
      })();
    }
    return () => locationWatcher?.remove();
  }, [isOnline, currentRideId]);

  useEffect(() => {
    const info = async () => {

      console.log("activeRequestRide", activeRequestRide);
      const coordinate = {
        latitude: activeRequestRide?.ride?.originLat,
        longitude: activeRequestRide?.ride?.originLng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
      console.log("coordinate", coordinate);

    }
    info()
    // refrescar cada 10 seg
  }, [activeRequestRide])

  // --- FUNCIONES DE APOYO ---

  const handleAction = async () => {
    setLoading(true);
    if (status === 'IDLE' || status === 'PICKUP') {
      const coords = { latitude: region.latitude, longitude: region.longitude };
      setPickupCoords(coords);
      getAddressFromCoords(coords.latitude, coords.longitude, true);
      setStatus('DESTINATION');
      setLoading(false);
    } else if (status === 'DESTINATION') {
      const coords = { latitude: region.latitude, longitude: region.longitude };
      await setDestinationCoords(coords);
      await getAddressFromCoords(coords.latitude, coords.longitude, false);
      await getPrice(coords);
      setLoading(false);
    }
  };

  const getAddressFromCoords = async (lat: number, lng: number, isPickup: boolean) => {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_APIKEY}`);
      const data = await res.json();
      if (data.results[0]) {
        const addr = data.results[0].formatted_address;

        if (isPickup) {
          pickupSearchRef.current?.setAddressText(addr);
          setPickupAddress(addr);
        } else {
          destinationSearchRef.current?.setAddressText(addr);
          setDestinationAddress(addr);
        }
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

  const handleCancelSolicitud = () => {
    Alert.alert(
      'CityGo',
      '¿Estás seguro de cancelar la solicitud de viaje? Algunos conductores ya fueron notificados de tu solicitud',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (currentRideId) {
                const response = await cancelSolicitudApi(currentRideId);
                console.log("Viaje cancelado:", response);
              }
              setStatus('ROUTE');
              setCurrentRideId(null);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Hubo un problema al cancelar la solicitud.');
            }
          },
        },
      ]
    );
  };

  const handleChangeRoute = () => {
    setStatus('PICKUP');
    setPickupCoords(null);
    setDestinationCoords(null);
    setRouteDetails(null);
    pickupSearchRef.current?.setAddressText('');
    destinationSearchRef.current?.setAddressText('');
    setPickupAddress('');
    setDestinationAddress('');
    centerOnUserLocation();
    setOtpValidate(false);
  };

  const handleRequestRide = async () => {
    try {
      setLoading(true);
      const data = {
        originAddress: pickupAddress,
        destinationAddress: destinationAddress,
        originLat: region.latitude,
        originLng: region.longitude,
        destLat: destinationCoords.latitude,
        destLng: destinationCoords.longitude,
        finalPrice: price,
      }
      console.log("Data enviada:", data);
      const response = await requestRideApi(data);
      console.log("Respuesta de la API:", response);

      socket.current.emit('joinRide', response.id);
      setCurrentRideId(response.id);
      setStatus('SEARCHING');

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTrip = async (tripId: string) => {
    setLoading(true);
    setOtpValidate(false);
    try {
      if (!pendingRequest) return;

      socket.current.emit('accept_trip', { tripId: pendingRequest.tripId, userId: userId }, async (response: any) => {
        console.log("triId", pendingRequest.tripId);
        console.log("Respuesta de la API:", response);
        if (response.status === 'success') {
          await AsyncStorage.setItem('activeRideId', pendingRequest.tripId);
          setCurrentRideId(pendingRequest.tripId);
          setActiveRequestRide(response.data);
          // 1. Limpiar solicitudes pendientes del mapa
          setAvailableRequests([]);
          setShowRequestDialog(false);

          // 2. Cambiar estado local del conductor

          setStatus('ON_RIDE');

          // 3. Centrar mapa en el cliente para ir a recogerlo
          const pickup = {
            latitude: response.data.ride.originLat,
            longitude: response.data.ride.originLng,
          };

          mapRef.current?.animateToRegion({
            ...pickup,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);

          Alert.alert("Viaje Asignado", "Dirígete al punto de recogida.");
        } else {
          Alert.alert("Error", response.message);
          setShowRequestDialog(false);
        }
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Hubo un problema al aceptar la solicitud.');
    } finally {
      setLoading(false);
    }

  };

  const handleArrivedAtPickup = () => {
    if (!currentRideId) return;

    // Notificamos al backend que el conductor está en la puerta
    socket.current.emit('driver_arrived', { rideId: currentRideId });

    Alert.alert(
      "CityGo",
      "Has notificado al cliente que estás en el punto de recogida.",
      [{ text: "OK", onPress: () => setShowOtpModal(true) }]
    );
  };

  const handleStartRide = () => {
    socket.current.emit('validate_start_code', {
      rideId: currentRideId,
      code: otpCode
    }, (response: any) => {
      if (response.success) {
        setOtpCode('');
        setShowOtpModal(false);
        setOtpValidate(true);

        // IMPORTANTE: Al pasar a ON_RIDE y haber validado el código, 
        // el MapViewDirections ahora usará destinationCoords automáticamente
        setStatus('ON_RIDE');

        // Retrasamos la alerta ligeramente para que la animación de cierre del Modal termine y no la tape
        setTimeout(() => {
          Alert.alert("¡Viaje Iniciado!", "Dirígete al destino final.");
        }, 400);
      } else {
        setOtpValidate(false);
        setOtpCode('');
        Alert.alert("Código Incorrecto", "El código no coincide. Verifica con el pasajero.");
      }
    });
  };

  const handleFinishRide = () => {
    Alert.alert(
      "Finalizar Viaje",
      "¿Confirmas que has llegado al destino y deseas finalizar la carrera?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar", style: "destructive", onPress: () => {
            if (currentRideId) {
              socket.current.emit('finish_trip', { rideId: currentRideId });
            }
            Alert.alert("¡Viaje Finalizado!", "El viaje ha concluido con éxito.");
            setStatus('PICKUP');
            setCurrentRideId(null);
            setActiveRequestRide(null);
            setPendingRequest(null);
            setOtpValidate(false);
            AsyncStorage.removeItem('activeRideId');
          }
        }
      ]
    );
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

        {/* Marcador del propio Conductor (Cuando está Online) */}
        {role === Roles.DRIVER && isOnline && myLocation && (
          <Marker
            coordinate={myLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ transform: [{ rotate: `${myLocation.heading || 0}deg` }] }}>
              <Image source={CarIcon} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>
          </Marker>
        )}

        {/* Marcador de Solicitud Entrante para el Conductor */}
        {role === Roles.DRIVER && isOnline && availableRequests.map((request) => (
          <Marker
            key={request.tripId}
            coordinate={{
              latitude: request.pickupCoords.lat,
              longitude: request.pickupCoords.lng
            }}
            onPress={() => {
              setPendingRequest(request);
              setShowRequestDialog(true);
            }}
          >
            <View style={styles.requestMarker}>
              <Ionicons name="person-circle" size={40} color="#10B981" onPress={() => {
                setPendingRequest(request);
                setShowRequestDialog(true);
              }} />
            </View>
          </Marker>
        ))}

        {/* Puntos de Ruta */}
        {pickupCoords && <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#1D4ED8" /></Marker>}
        {destinationCoords && <Marker coordinate={destinationCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#EF4444" /></Marker>}

        {/*{status === 'ROUTE' && pickupCoords && destinationCoords && (
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
        )}*/}

        {((status === 'ROUTE' && pickupCoords && destinationCoords) ||
          (status === 'ON_RIDE' && myLocation && pendingRequest)) && (
            <MapViewDirections
              // Si ya aceptamos (ON_RIDE), el origen es la ubicación real del conductor
              origin={status === 'ON_RIDE' ? myLocation : pickupCoords}

              // El destino depende de si el conductor está recogiendo o ya lleva al pasajero
              destination={
                // Si NO hemos validado el código, el destino es recoger al cliente
                // Si SÍ hemos validado el código, el destino es el final del viaje
                status === 'ON_RIDE' && !otpValidate
                  ? { latitude: activeRequestRide.ride.originLat, longitude: activeRequestRide.ride.originLng }
                  : { latitude: activeRequestRide.ride.destLat, longitude: activeRequestRide.ride.destLng }
              }

              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={5}
              strokeColor={status === 'ON_RIDE' ? "#10B981" : "#1D4ED8"}
              onReady={res => {
                setRouteDetails(res);
                // Ajuste de cámara para que el conductor vea su avance hacia el cliente
                mapRef.current?.fitToCoordinates(res.coordinates, {
                  edgePadding: { top: 100, right: 50, bottom: 300, left: 50 }
                });
              }}
            />
          )}

        {status === 'ON_RIDE' && role === Roles.DRIVER && activeRequestRide && !otpValidate && (
          <Marker
            coordinate={{
              latitude: activeRequestRide.ride.originLat,
              longitude: activeRequestRide.ride.originLng
            }}
            title="Recoger aquí"
          >
            <View style={styles.pickupMarkerContainer}>
              <Ionicons name="person-circle" size={40} color="#10B981" />
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>CLIENTE</Text>
              </View>
            </View>
          </Marker>
        )}

        {status === 'ON_RIDE' && role === Roles.DRIVER && activeRequestRide && otpValidate && (
          <Marker
            coordinate={{
              latitude: activeRequestRide.ride.destLat,
              longitude: activeRequestRide.ride.destLng
            }}
            title="Destino"
            anchor={{ x: 0.5, y: 1 }}
          >
            <Ionicons name="location" size={50} color="#EF4444" />
          </Marker>
        )}
      </MapView>

      {/* Driver Interface - Online Toggle */}
      {role === Roles.DRIVER && (isOnline || (status !== 'ROUTE' && status !== 'SEARCHING')) && (
        <View style={[styles.driverInterface, { top: insets.top + (isOnline ? 10 : 150), zIndex: isOnline ? 2000 : 900 }]}>
          <View style={styles.statusCard}>
            <Text style={styles.statusText}>{isOnline ? 'EN LÍNEA' : 'FUERA DE LÍNEA'}</Text>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isOnline ? "#1D4ED8" : "#f4f3f4"}
            />
          </View>
        </View>
      )}

      {/* Buscadores Flotantes */}
      {!isOnline && status !== 'ROUTE' && status !== 'ON_RIDE' && status !== 'SEARCHING' && (
        <View style={[styles.searchContainer, { top: insets.top + 10 }]}>
          <GooglePlacesAutocomplete
            ref={pickupSearchRef}
            placeholder="¿Recogida?"
            fetchDetails={true}
            onPress={(data, details) => {
              setPickupAddress(data.description || details?.formatted_address || '');
              moveToLocation(details, true);
            }}
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
            onPress={(data, details) => {
              setDestinationAddress(data.description || details?.formatted_address || '');
              moveToLocation(details, false);
            }}
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
      {!isOnline && (status === 'PICKUP' || status === 'DESTINATION' || status === 'IDLE') && (
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
      <View style={[styles.bottomContainer, { bottom: insets.bottom + 0 }]}>
        {status === 'SEARCHING' ? (
          <View style={styles.searchingCard}>
            <ActivityIndicator size="large" color="#1D4ED8" style={{ marginBottom: 15 }} />
            <Text style={styles.searchingTitle}>Buscando conductor...</Text>
            <Text style={styles.searchingSubtext}>Notificando a los conductores cercanos a tu punto de recogida.</Text>
            <TouchableOpacity
              style={styles.btnCancelSearch}
              onPress={() => handleCancelSolicitud()}
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

            <TouchableOpacity style={styles.btnConfirm} onPress={handleRequestRide} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Confirmar Viaje</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={handleChangeRoute}
            >
              <Text style={styles.btnCancelText}>Cambiar Ruta / Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          !isOnline && (
            <TouchableOpacity style={styles.mainActionBtn} onPress={handleAction} disabled={loading}>
              <Text style={styles.mainActionText}>
                {loading ? <ActivityIndicator color="white" /> : (status === 'IDLE' || status === 'PICKUP') ? 'Confirmar Recogida' : 'Confirmar Destino'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Diálogo de Nueva Solicitud (Conductor) */}
      {role === Roles.DRIVER && isOnline && pendingRequest && showRequestDialog && (
        <View style={[styles.bottomContainer, { bottom: insets.bottom + 0, zIndex: 3000 }]}>
          <View style={styles.confirmCard}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 15, right: 15, zIndex: 10 }}
              onPress={() => setShowRequestDialog(false)}
            >
              <Ionicons name="close" size={28} color="#6B7280" />
            </TouchableOpacity>

            <Text style={[styles.searchingTitle, { color: '#10B981', textAlign: 'center', marginBottom: 5 }]}>¡Nueva Solicitud de Viaje!</Text>

            <View style={{ marginBottom: 10, marginTop: 10 }}>
              <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>Recogida:</Text>
              <Text style={{ color: '#6B7280' }}>{pendingRequest.originAddress || 'Cargando...'}</Text>
            </View>

            <View style={{ marginBottom: 15 }}>
              <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>Destino:</Text>
              <Text style={{ color: '#6B7280' }}>{pendingRequest.destinationAddress || 'Cargando...'}</Text>
            </View>

            <View style={[styles.priceRow, { justifyContent: 'center', marginBottom: 20 }]}>
              <Text style={styles.priceText}>${(pendingRequest.price || 0).toFixed(2)}</Text>
              {pendingRequest.distance && <Text style={[styles.distanceText, { marginLeft: 10 }]}>{pendingRequest.distance}</Text>}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <TouchableOpacity style={[styles.btnCancelSearch, { flex: 1, padding: 15 }]} onPress={() => {
                setPendingRequest(null);
                setShowRequestDialog(false);
              }}>
                <Text style={styles.btnCancelSearchText}>Declinar</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={loading} style={[styles.btnConfirm, { flex: 1, padding: 15 }]} onPress={() => handleAcceptTrip(pendingRequest.tripId)}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Aceptar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      {status === 'ON_RIDE' && role === Roles.DRIVER && !otpValidate && (
        <View style={styles.bottomContainer}>
          <View style={styles.confirmCard}>
            <Text style={styles.statusLabel}>RECOGER PASAJERO</Text>
            <View style={styles.clientInfoRow}>
              <Ionicons name="person" size={24} color="#1D4ED8" />
              <Text style={styles.clientNameText}>
                Recoger a: {pendingRequest?.clientName || 'Pasajero'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: '#10B981', marginTop: 15 }]}
              onPress={handleArrivedAtPickup}
            >
              <Text style={styles.btnText}>¡HE LLEGADO!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === 'ON_RIDE' && role === Roles.DRIVER && otpValidate && (
        <View style={styles.bottomContainer}>
          <View style={styles.confirmCard}>
            <Text style={styles.statusLabel}>VIAJE EN CURSO</Text>
            <View style={styles.clientInfoRow}>
              <Ionicons name="location" size={24} color="#EF4444" />
              <Text style={styles.clientNameText}>
                Llevando a {pendingRequest?.clientName || 'Pasajero'} a su destino
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: '#EF4444', marginTop: 15 }]}
              onPress={handleFinishRide}
            >
              <Text style={styles.btnText}>FINALIZAR CARRERA</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showOtpModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}
        >
          <View style={[styles.bottomContainer, { position: 'relative', bottom: insets.bottom }]}>
            <View style={styles.confirmCard}>
              <TouchableOpacity
                style={{ position: 'absolute', top: 15, right: 15, zIndex: 10 }}
                onPress={() => setShowOtpModal(false)}
              >
                <Ionicons name="close" size={28} color="#6B7280" />
              </TouchableOpacity>

              <Text style={[styles.searchingTitle, { color: '#1E3A8A', textAlign: 'center', marginBottom: 5 }]}>Código de Seguridad</Text>
              <Text style={{ color: '#6B7280', textAlign: 'center', marginBottom: 15 }}>Solicita el código de 3 dígitos al pasajero</Text>

              <TextInput
                style={styles.otpInput}
                placeholder="000"
                keyboardType="numeric"
                maxLength={3}
                onChangeText={setOtpCode}
                value={otpCode}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <TouchableOpacity style={[styles.btnCancelSearch, { flex: 1, padding: 15 }]} onPress={() => setShowOtpModal(false)}>
                  <Text style={styles.btnCancelSearchText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnConfirm, { flex: 1, padding: 15, opacity: otpCode.length === 3 ? 1 : 0.5 }]}
                  onPress={handleStartRide}
                  disabled={otpCode.length !== 3}
                >
                  <Text style={styles.btnText}>INICIAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  requestMarker: {
    alignItems: 'center',
  },
  priceBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: -10,
  },
  priceBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },

  clientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 15,
    marginBottom: 5,
  },

  clientNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
    marginLeft: 10,
  },
  pickupMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  otpCard: {
    width: '80%',
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center'
  },
  otpTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E3A8A' },
  otpSubtitle: { color: '#6B7280', marginVertical: 10 },
  otpInput: {
    width: '100%',
    height: 70,
    borderWidth: 2,
    borderColor: '#1D4ED8', // Azul de CityGo
    borderRadius: 15,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 20, // Más espacio entre números
    marginVertical: 20,
    color: '#1E3A8A'
  }
});