import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Switch, Image, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import MapView, { Marker, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import MapZoomControls from '../components/MapZoomControls';
import * as Notifications from 'expo-notifications';
import ChatModal from '../components/ChatModal';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';
import AsyncStorage from "@react-native-async-storage/async-storage";
import CarIcon from '../../assets/car_icon.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Roles } from '../../utils/services/rolesEnum';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import io from 'socket.io-client';
import { BACKEND_URL } from '../../utils/services/apiConfig';
import { cancelSolicitudApi, getActiveRideApi, getPriceApi, requestRideApi } from '../../utils/services/ridesServices';
import RatingModal from '../components/RatingModal';
import { sendRatingApi, updateStatusDriverApi } from '../../utils/services/userService';
import { coordsFromRideData, isActiveBackendRideStatus, isChatEnabledRideStatus, isTripInProgress, mapBackendStatusToPassengerScreen } from '../../utils/services/rideFlow';
import { useCustomAlert } from '../../utils/context/AlertContext';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBfVCCME9FaQG7zUd0xbeAQDehrYnFrpZA';
const SOCKET_URL = BACKEND_URL; // Tu backend NestJS

export default function UserHomeScreen({ isDriverOffline, onOnline }: { isDriverOffline?: boolean, onOnline?: () => void }) {
    const { showAlert } = useCustomAlert();
    const insets = useSafeAreaInsets();
    const [userId, setUserId] = useState<string | null>(null);
    const [region, setRegion] = useState<any>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [status, setStatus] = useState<'IDLE' | 'PICKUP' | 'DESTINATION' | 'ROUTE' | 'SEARCHING' | 'TO_DESTINO' | 'ON_RIDE' | 'REQUESTED' | 'ACCEPTED' | 'TO_PICKUP' | 'IN_PROGRESS' | 'TO_RATING' | 'COMPLETED' | 'CANCELLED'>('PICKUP');
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
    const [optValue, setOptvalue] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpValidate, setOtpValidate] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [rideId, setRideId] = useState<string | null>(null);
    const [initialChatMessages, setInitialChatMessages] = useState<any[]>([]);
    const [activeRideBackendStatus, setActiveRideBackendStatus] = useState<string | null>(null);

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
        if (!userId) return;

        let isMounted = true;

        const connectSocket = async () => {
            const token = await AsyncStorage.getItem('authToken');
            if (!isMounted) return;

            // --- EL CAMBIO CLAVE: Pasar token y userId ---
            socket.current = io(SOCKET_URL, {
                query: { userId: userId },
                auth: { token },
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

            socket.current.on('trip_accepted', async (data: any) => {
                console.log("¡Viaje aceptado!", data);
                socket.current.emit('joinRide', data.rideId);
                setRideId(data.rideId);
                setCurrentRideId(data.rideId);

                setDriverInfo({
                    name: data.driverName,
                    vehicle: data.driverVehicle,
                });
                setDriverLocation(data.currentLocation);
                setActiveRideBackendStatus('ACCEPTED');
                setStatus('ON_RIDE');
                await AsyncStorage.setItem('activeRideId', data.rideId);
                showAlert("¡Conductor asignado!", `Tu conductor va en camino.`);
            });

            socket.current.on('driver_is_outside', (data: any) => {
                setActiveRideBackendStatus(data?.status || 'DRIVER_ARRIVED');
                setStatus('ON_RIDE');
                showAlert("¡Conductor Llegando!", data.message || "El conductor llegó a recogerte, sal ahora!");
            });

            socket.current.on('ride_started', (data: any) => {
                setActiveRideBackendStatus(data?.status || 'IN_PROGRESS');
                setStatus('TO_DESTINO');
                showAlert("¡Viaje Iniciado!", data.message || "El conductor ha iniciado el viaje.");
            })

            socket.current.on('driver_location_update', (newCoords: any) => {
                const coords = {
                    latitude: newCoords.coords.lat || newCoords.coords.latitude,
                    longitude: newCoords.coords.lng || newCoords.coords.longitude,
                    heading: newCoords.coords.heading || 0,
                };

                if (!coords.latitude || !coords.longitude) return;

                // Actualizamos la posición animada (Para que el carro no de saltos)
                animatedDriverCoords.timing({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    duration: 1000, // Duración del paso
                    useNativeDriver: false
                } as any).start();

                // Guardamos el heading para la rotación del icono
                setDriverLocation(coords);
            });

            socket.current.on('trip_taken', (data: { tripId: string }) => {
                setAvailableRequests(prev => prev.filter(r => r.tripId !== data.tripId));
                if (pendingRequest?.tripId === data.tripId) {
                    setShowRequestDialog(false);
                    showAlert("Viaje no disponible", "Otro conductor ha aceptado esta carrera.");
                }
            });

            socket.current.on('trip_completed_success', async () => {
                // 1. Limpiar persistencia
                await AsyncStorage.removeItem('activeRideId');

                // 2. Resetear estados de la UI
                setCurrentRideId(null);
                setPendingRequest(null);
                setActiveRequestRide(null);
                setDriverInfo(null);
                setPickupCoords(null);
                setDestinationCoords(null);
                setRouteDetails(null);
                setPickupAddress('');
                setDestinationAddress('');
                setOtpValidate(false);
                pickupSearchRef.current?.setAddressText('');
                destinationSearchRef.current?.setAddressText('');

                setStatus('IDLE'); // O 'PICKUP' según tu enum inicial
                centerOnUserLocation();

                showAlert("Viaje Finalizado", "Ya puedes recibir nuevas solicitudes.");
            });

            socket.current.on('ride_cancelled_by_driver', async () => {
                await AsyncStorage.removeItem('activeRideId');
                setCurrentRideId(null);
                setActiveRideBackendStatus(null);
                setDriverInfo(null);
                setPickupCoords(null);
                setDestinationCoords(null);
                setRouteDetails(null);
                setPickupAddress('');
                setDestinationAddress('');
                pickupSearchRef.current?.setAddressText('');
                destinationSearchRef.current?.setAddressText('');
                setStatus('PICKUP');
                centerOnUserLocation();
                showAlert(
                    "Carrera cancelada",
                    "El conductor ha cancelado la carrera. Puedes solicitar un nuevo viaje."
                );
            });

            socket.current.on('ride_finished', async (data: any) => {
                // Guardamos el estado para calificar, pero limpiamos el mapa
                setPickupCoords(null);
                setDestinationCoords(null);
                setRouteDetails(null);
                setPickupAddress('');
                setDestinationAddress('');
                setOtpValidate(false);
                pickupSearchRef.current?.setAddressText('');
                destinationSearchRef.current?.setAddressText('');

                setStatus('TO_RATING');
                setActiveRideBackendStatus('TO_RATING');
                centerOnUserLocation();

                // 3. Mostrar resumen
                showAlert(
                    "¡Llegamos! Esperamos que hayas tenido un buen viaje, no olvides calificar al conductor",
                );
                setRatingModalVisible(true);
            });


        };

        connectSocket();

        return () => {
            isMounted = false;
            if (socket.current) socket.current.disconnect();
        };

    }, [userId, role]);

    useEffect(() => {
        const restoreSession = async () => {
            console.log("Ingresa a restoreSession");
            try {
                const response = await getActiveRideApi();
                console.log("response getActiveRideApi", response);
                if (!response || !response.rideData || !isActiveBackendRideStatus(response.status)) {
                    await AsyncStorage.removeItem('activeRideId');
                    return;
                }

                const activeRideId = response.rideData.tripId;
                await AsyncStorage.setItem('activeRideId', activeRideId);
                setCurrentRideId(activeRideId);
                setRideId(activeRideId);
                setActiveRideBackendStatus(response.status);
                setOptvalue(response.rideData.otp);
                setDriverInfo(response.rideData.driver);
                setInitialChatMessages(response.rideData.messages || []);
                setActiveRequestRide({ ride: response.rideData, driverId: response.rideData.driver?.id });

                const coords = coordsFromRideData(response.rideData);
                setPickupCoords(coords.pickup);
                setDestinationCoords(coords.destination);
                setPickupAddress(response.rideData.originAddress || '');
                setDestinationAddress(response.rideData.destAddress || '');
                setPendingRequest({
                    tripId: activeRideId,
                    clientName: response.rideData?.clientName || 'Pasajero',
                });

                socket.current?.emit('joinRide', activeRideId);

                if (response.status === 'TO_RATING') {
                    setStatus('TO_RATING');
                    setRatingModalVisible(true);
                    return;
                }

                setOtpValidate(isTripInProgress(response.status));
                setStatus(mapBackendStatusToPassengerScreen(response.status) as any);
            } catch (error) {
                console.log("No se pudo restaurar desde backend, intento con activeRideId local", error);
                const savedRideId = await AsyncStorage.getItem('activeRideId');
                if (savedRideId && socket.current) {
                    socket.current.emit('getRideStatus', { rideId: savedRideId }, async (response: any) => {
                        if (!response || !response.rideData || !isActiveBackendRideStatus(response.status)) {
                            AsyncStorage.removeItem('activeRideId');
                            return;
                        }
                        await AsyncStorage.setItem('activeRideId', savedRideId);
                        setCurrentRideId(savedRideId);
                        setRideId(savedRideId);
                        setActiveRideBackendStatus(response.status);
                        setOptvalue(response.rideData.otp);
                        setDriverInfo(response.rideData.driver);
                        setInitialChatMessages(response.rideData.messages || []);
                        setActiveRequestRide({ ride: response.rideData, driverId: response.rideData.driver?.id });
                        const coords = coordsFromRideData(response.rideData);
                        setPickupCoords(coords.pickup);
                        setDestinationCoords(coords.destination);
                        socket.current.emit('joinRide', savedRideId);
                        setOtpValidate(isTripInProgress(response.status));
                        setStatus(mapBackendStatusToPassengerScreen(response.status) as any);
                    });
                }
            }
        };
        restoreSession();
    }, [userId])

    // 2. Obtener ubicación inicial y Rol
    useEffect(() => {
        (async () => {
            try {
                const savedRole = await AsyncStorage.getItem('role');
                setRole(savedRole);

                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const applyLocation = (loc: Location.LocationObject) => {
                    const { latitude, longitude, heading } = loc.coords;
                    setRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
                    setMyLocation({ latitude, longitude, heading: heading || 0 });
                    setPickupCoords({ latitude, longitude });
                    getAddressFromCoords(latitude, longitude, true);
                };

                // 1. Posición cacheada: instantánea, muestra el mapa de inmediato
                const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
                if (last) applyLocation(last);

                // 2. Posición precisa en segundo plano: actualiza sin bloquear
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                }).then(loc => {
                    applyLocation(loc);
                }).catch(() => { /* GPS no disponible, la posición cacheada es suficiente */ });

            } catch (error) {
                console.log("Error al obtener ubicacion", error);
            }
        })();
    }, []);

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
            const destCoords = { latitude: region.latitude, longitude: region.longitude };
            // Pickup puede no estar en estado actualizado si venimos del buscador;
            // lo leemos de pickupCoords (ya fue seteado en el paso anterior).
            const origin = pickupCoords ?? { latitude: region.latitude, longitude: region.longitude };
            setDestinationCoords(destCoords);
            await getAddressFromCoords(destCoords.latitude, destCoords.longitude, false);
            await getPrice(destCoords, origin);
            setLoading(false);
        }
    };

    const getAddressFromCoords = async (lat: number, lng: number, isPickup: boolean) => {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&key=${GOOGLE_MAPS_APIKEY}`
            );
            const data = await res.json();

            // Skip results whose type is 'plus_code' — those are the cryptic codes like "7Q2J+3Q"
            const bestResult = (data.results as any[])?.find(
                (r: any) => !(r.types as string[])?.includes('plus_code')
            ) ?? data.results?.[0];

            if (!bestResult) return;

            // Build a human-readable address from components (avoids Plus Codes & postal codes)
            const components: any[] = bestResult.address_components ?? [];
            const get = (type: string): string =>
                components.find((c: any) => (c.types as string[]).includes(type))?.long_name ?? '';

            const streetNumber = get('street_number');
            const route        = get('route');
            const neighborhood = get('neighborhood') || get('sublocality_level_1') || get('sublocality');
            const city         = get('locality') || get('administrative_area_level_2');

            let addr = '';
            if (route) {
                addr = streetNumber ? `${route} ${streetNumber}` : route;
                if (neighborhood) addr += `, ${neighborhood}`;
            } else if (neighborhood) {
                addr = city ? `${neighborhood}, ${city}` : neighborhood;
            } else {
                // Last resort: strip Plus Codes (XXXX+XX) and postal codes from formatted_address
                addr = (bestResult.formatted_address as string)
                    .replace(/\b[A-Z0-9]{4,}\+[A-Z0-9]{2,}\b\s*/g, '')  // Plus Code
                    .replace(/\b\d{4,6}\b/g, '')                          // Postal code
                    .replace(/,\s*,/g, ',')
                    .replace(/^[,\s]+|[,\s]+$/g, '')
                    .trim();
            }

            if (isPickup) {
                pickupSearchRef.current?.setAddressText(addr);
                setPickupAddress(addr);
            } else {
                destinationSearchRef.current?.setAddressText(addr);
                setDestinationAddress(addr);
            }
        } catch (e) {
            console.error('[Geocoding] Error:', e);
        }
    };

    const moveToLocation = (details: any, isPickup: boolean) => {
        const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
        if (isPickup) {
            setPickupCoords(coords);
            setStatus('DESTINATION');
        } else {
            setDestinationCoords(coords);

            // Si el pickup aún no estaba fijado, usamos la posición actual del mapa.
            // Guardamos la referencia local para pasársela a getPrice de inmediato,
            // porque setPickupCoords es async y el estado no se actualiza en este ciclo.
            let effectivePickup = pickupCoords;
            if (!effectivePickup) {
                effectivePickup = { latitude: region.latitude, longitude: region.longitude };
                setPickupCoords(effectivePickup);
                getAddressFromCoords(effectivePickup.latitude, effectivePickup.longitude, true);
            }

            // Calcular precio pasando el pickup explícitamente (evita closure stale).
            // getPrice cambia el status a 'ROUTE' internamente.
            getPrice(coords, effectivePickup);
        }
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
    };

    const centerOnUserLocation = async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = loc.coords;
            mapRef.current?.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            }, 1000);
            // Actualizar recogida con la ubicación real del usuario
            setPickupCoords({ latitude, longitude });
            getAddressFromCoords(latitude, longitude, true);
        } catch (e) {
            console.warn("Could not get user location", e);
        }
    };

    const useDriverTracking = () => {
        const [driverLocation, setDriverLocation] = useState<{
            latitude: number;
            longitude: number;
            heading?: number; // Para que el icono del carro gire
        } | null>(null);

        useEffect(() => {
            if (!socket || !activeRequestRide?.tripId) return;

            // Escuchamos el evento específico de este viaje
            // El backend debe emitir a: `ride_location_${activeRideId}`
            const eventName = `locationUpdated`;

            socket.current.on(eventName, (data: any) => {
                console.log("data", data);

                if (data.rideId === activeRequestRide?.tripId) {
                    setDriverLocation({
                        latitude: data.coords.lat || data.coords.latitude,
                        longitude: data.coords.lng || data.coords.longitude,
                        heading: data.coords.heading || 0,
                    });
                }
            });

            return () => {
                socket.current.off(eventName);
            };
        }, [socket, activeRequestRide?.tripId]);

        return driverLocation;
    };
    const driverLocationUser = useDriverTracking();
    // explicitPickup: cuando se llama desde moveToLocation el pickupCoords del estado
    // puede no estar actualizado todavía (closure stale), así que se pasa explícitamente.
    const getPrice = async (
        destinationCoords: { latitude: number, longitude: number },
        explicitPickup?: { latitude: number, longitude: number },
    ) => {
        const origin = explicitPickup ?? pickupCoords;
        if (!origin) return;
        try {
            const price = await getPriceApi(origin.latitude, origin.longitude, destinationCoords.latitude, destinationCoords.longitude);
            setPrice(price.total);
            setDistance(price.distance);
            setTime(price.duration);
            setError(null);
            setStatus('ROUTE');
        } catch (e) {
            setPrice(0);
            setDistance(0);
            setTime(0);
            setError("TUVIMOS UN PROBLEMA AL OBTENER EL PRECIO, PERO EL CONDUCTOR TE DARÁ SU MEJOR TARIFA SI DECIDES CONTINUAR!");
            console.warn("Could not get price", e);
            setStatus('ROUTE');
        }
    };

    const handleCancelSolicitud = () => {
        showAlert(
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
                            showAlert('Error', 'Hubo un problema al cancelar la solicitud.');
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
        setInitialChatMessages([]);
    };

    const handleRequestRide = async () => {
        try {
            setLoading(true);
            const data = {
                originAddress: pickupAddress,
                destinationAddress: destinationAddress,
                originLat: pickupCoords.latitude,
                originLng: pickupCoords.longitude,
                destLat: destinationCoords.latitude,
                destLng: destinationCoords.longitude,
                finalPrice: price,
                paymentMethod,
            }
            console.log("Data enviada:", data);
            const response = await requestRideApi(data);
            console.log("Respuesta de la API:", response);
            setOptvalue(response.otp);

            socket.current.emit('joinRide', response.id);
            setCurrentRideId(response.id);
            setActiveRideBackendStatus('REQUESTED');
            await AsyncStorage.setItem('activeRideId', response.id);
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
                    setActiveRideBackendStatus('ACCEPTED');
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

                    showAlert("Viaje Asignado", "Dirígete al punto de recogida.");
                } else {
                    showAlert("Error", response.message);
                    setShowRequestDialog(false);
                }
            });
        } catch (e) {
            console.error(e);
            showAlert('Error', 'Hubo un problema al aceptar la solicitud.');
        } finally {
            setLoading(false);
        }

    };

    const clearRideData = async () => {
        setStatus('IDLE');
        setCurrentRideId(null);
        setActiveRequestRide(null);
        setPendingRequest(null);
        setDriverInfo(null);
        setPickupCoords(null);
        setDestinationCoords(null);
        setRouteDetails(null);
        setPickupAddress('');
        setDestinationAddress('');
        setOtpValidate(false);
        setActiveRideBackendStatus(null);
        pickupSearchRef.current?.setAddressText('');
        destinationSearchRef.current?.setAddressText('');
        await AsyncStorage.removeItem('activeRideId');
        centerOnUserLocation();
    };

    const handleSendRating = async (score: number, comment: string) => {
        try {
            const response = await sendRatingApi({
                rideId: currentRideId,
                driverId: activeRequestRide?.driverId || driverInfo?.id, // Fallback por si acaso
                score,
                comment,
            });
            console.log("Respuesta de la API:", response);
            showAlert("Calificación enviada", "Gracias por tu comentario.");
        } catch (e) {
            console.error(e);
            showAlert("Error", "Hubo un problema al enviar la calificación.");
        } finally {
            setRatingModalVisible(false);
            clearRideData();
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
                {(status === 'ON_RIDE' || status === 'TO_DESTINO') && role === Roles.USER && driverLocation && driverLocation.latitude && driverLocation.longitude && (
                    <Marker.Animated
                        key="driver-marker"
                        coordinate={animatedDriverCoords as any}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true} // Importante para que la rotación se vea natural sobre el mapa
                    >
                        <View style={{ transform: [{ rotate: `${driverLocation.heading || 0}deg` }] }}>
                            <Image
                                source={require('../../assets/car_icon.png')}
                                style={{ width: 40, height: 40 }}
                                resizeMode="contain"
                            />
                        </View>
                    </Marker.Animated>
                )}


                {/* Puntos de Ruta */}
                {pickupCoords && <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#1D4ED8" /></Marker>}
                {destinationCoords && <Marker coordinate={destinationCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#EF4444" /></Marker>}

                {role === Roles.USER && (status === 'ON_RIDE' || status === 'TO_DESTINO') && driverLocation && (
                    <MapViewDirections
                        origin={driverLocation} // Sale de donde está el carro actualmente
                        destination={status === 'ON_RIDE' ? pickupCoords : destinationCoords}
                        apikey={GOOGLE_MAPS_APIKEY}
                        strokeWidth={5}
                        strokeColor="#1D4ED8"
                        onReady={res => {
                            // No usamos fitToCoordinates aquí para no "marear" al usuario moviendo la cámara solo
                        }}
                    />
                )}


                {/* Renderizado de Rutas Inteligente */}
                {(
                    (status === 'ROUTE' && pickupCoords && destinationCoords) ||
                    ((status === 'ON_RIDE' || status === 'TO_DESTINO') && activeRequestRide)
                ) && (
                        <MapViewDirections
                            // ORIGEN:
                            // 1. Si soy el conductor asignado al viaje: Salgo de MI ubicación actual.
                            // 2. Si soy el cliente (aunque sea conductor de profesión): Salgo de mi punto de recogida.
                            origin={
                                (status === 'ON_RIDE' || status === 'TO_DESTINO') && activeRequestRide?.driverId === userId
                                    ? myLocation
                                    : pickupCoords
                            }

                            // DESTINO:
                            destination={
                                // Si soy el conductor asignado:
                                (status === 'ON_RIDE' || status === 'TO_DESTINO') && activeRequestRide?.driverId === userId
                                    ? (!otpValidate
                                        ? { latitude: activeRequestRide.ride.originLat, longitude: activeRequestRide.ride.originLng }
                                        : { latitude: activeRequestRide.ride.destLat, longitude: activeRequestRide.ride.destLng })
                                    // Si soy el cliente:
                                    : destinationCoords
                            }

                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={5}
                            // Color: Verde si estoy conduciendo, Azul si estoy esperando/viajando
                            strokeColor={activeRequestRide?.driverId === userId ? "#10B981" : "#1D4ED8"}

                            onReady={res => {
                                setRouteDetails(res);
                                mapRef.current?.fitToCoordinates(res.coordinates, {
                                    edgePadding: { top: 80, right: 50, bottom: 320, left: 50 }
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

                {(status === 'ON_RIDE' || status === 'TO_DESTINO') && driverLocationUser && (
                    <Marker
                        coordinate={{
                            latitude: driverLocationUser.latitude,
                            longitude: driverLocationUser.longitude,
                        }}
                        rotation={driverLocationUser.heading}
                        flat={true} // Mantiene el icono pegado al mapa al rotar
                    >
                        <Image
                            source={require('../../assets/car_icon.png')}
                            style={{ width: 40, height: 40 }}
                        />
                    </Marker>
                )}

            </MapView>

            {/* Driver Interface - Online Toggle */}
            {role === Roles.DRIVER && isDriverOffline && ['IDLE', 'PICKUP', 'DESTINATION', 'ROUTE'].includes(status) && (
                <View style={[styles.driverInterface, { top: insets.top + 10, zIndex: 900 }]}>
                    <View style={styles.statusCard}>
                        <Text style={styles.statusText}>{isOnline ? 'EN LÍNEA' : 'FUERA DE LÍNEA'}</Text>
                        <Switch
                            value={isOnline}
                            onValueChange={async (val) => {
                                setIsOnline(val);
                                await updateStatusDriverApi(val);
                                if (val && onOnline) {
                                    onOnline();
                                }
                            }}
                            trackColor={{ false: "#767577", true: "#81b0ff" }}
                            thumbColor={isOnline ? "#1D4ED8" : "#f4f3f4"}
                        />
                    </View>
                </View>
            )}

            {/* Buscadores Flotantes */}
            {/* Cuando el conductor está en modo offline, el switch ocupa ~60 px arriba,
                por eso desplazamos el buscador hacia abajo para que no se solapen. */}
            {!isOnline && status !== 'ROUTE' && status !== 'ON_RIDE' && status !== 'TO_DESTINO' && status !== 'SEARCHING' && (
                <View style={[styles.searchContainer, { top: isDriverOffline ? insets.top + 76 : insets.top + 10 }]}>

                    {/* Pickup */}
                    <View style={styles.searchRow}>
                        <View style={styles.searchDot} />
                        <View style={{ flex: 1 }}>
                            <GooglePlacesAutocomplete
                                ref={pickupSearchRef}
                                placeholder="¿Dónde te recogemos?"
                                fetchDetails={true}
                                minLength={2}
                                debounce={400}
                                onPress={(data, details) => {
                                    if (!details) return;
                                    setPickupAddress(data.description || details.formatted_address || '');
                                    moveToLocation(details, true);
                                }}
                                onFail={(error) => console.warn('[Places pickup] onFail:', error)}
                                onNotFound={() => console.log('[Places pickup] sin resultados')}
                                query={{
                                    key: GOOGLE_MAPS_APIKEY,
                                    language: 'es',
                                    components: 'country:ec',
                                    location: '-2.9001285,-79.0058965', // Centro de Cuenca
                                    radius: '30000',                    // 30 km — sesga hacia Cuenca sin excluir el resto
                                }}
                                styles={{
                                    container: { flex: 0, width: '100%', zIndex: 20 },
                                    listView: {
                                        backgroundColor: 'white',
                                        borderRadius: 10,
                                        elevation: 10,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 4,
                                        maxHeight: 200,
                                        zIndex: 20,
                                    },
                                    textInput: styles.searchInput,
                                    row: { padding: 13, height: 44, flexDirection: 'row' },
                                    separator: { height: 0.5, backgroundColor: '#F3F4F6' },
                                }}
                                enablePoweredByContainer={false}
                                keyboardShouldPersistTaps="handled"
                                listUnderlayColor="#F3F4F6"
                                textInputProps={{
                                    placeholderTextColor: '#9CA3AF',
                                    clearButtonMode: 'while-editing',
                                }}
                            />
                        </View>
                    </View>

                    <View style={styles.searchDivider} />

                    {/* Destination */}
                    <View style={styles.searchRow}>
                        <View style={[styles.searchDot, styles.searchDotDestination]} />
                        <View style={{ flex: 1 }}>
                            <GooglePlacesAutocomplete
                                ref={destinationSearchRef}
                                placeholder="¿A dónde vas?"
                                fetchDetails={true}
                                minLength={2}
                                debounce={400}
                                onPress={(data, details) => {
                                    if (!details) return;
                                    setDestinationAddress(data.description || details.formatted_address || '');
                                    moveToLocation(details, false);
                                }}
                                onFail={(error) => console.warn('[Places destino] onFail:', error)}
                                onNotFound={() => console.log('[Places destino] sin resultados')}
                                query={{
                                    key: GOOGLE_MAPS_APIKEY,
                                    language: 'es',
                                    components: 'country:ec',
                                    location: '-2.9001285,-79.0058965', // Centro de Cuenca
                                    radius: '30000',                    // 30 km — sesga hacia Cuenca sin excluir el resto
                                }}
                                styles={{
                                    container: { flex: 0, width: '100%', zIndex: 10 },
                                    listView: {
                                        backgroundColor: 'white',
                                        borderRadius: 10,
                                        elevation: 10,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.15,
                                        shadowRadius: 4,
                                        maxHeight: 200,
                                        zIndex: 10,
                                    },
                                    textInput: styles.searchInput,
                                    row: { padding: 13, height: 44, flexDirection: 'row' },
                                    separator: { height: 0.5, backgroundColor: '#F3F4F6' },
                                }}
                                enablePoweredByContainer={false}
                                keyboardShouldPersistTaps="handled"
                                listUnderlayColor="#F3F4F6"
                                textInputProps={{
                                    placeholderTextColor: '#9CA3AF',
                                    clearButtonMode: 'while-editing',
                                }}
                            />
                        </View>
                    </View>

                    {/* Hint: también pueden mover el mapa */}
                    <Text style={styles.searchHint}>
                        💡 También puedes mover el mapa y confirmar con el botón de abajo
                    </Text>
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
                ) : status == "TO_DESTINO" ? (
                    <View style={styles.bottomContainer}>
                        <View style={styles.confirmCard}>
                            <Text style={[styles.statusLabel, { color: '#10B981' }]}>YA ESTAMOS EN CAMINO</Text>

                            {isChatEnabledRideStatus(activeRideBackendStatus) && (
                                <TouchableOpacity
                                    style={[styles.btnConfirm, { backgroundColor: '#10B981', marginTop: 15, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}
                                    onPress={() => setIsChatVisible(true)}
                                >
                                    <Ionicons name="chatbubbles" size={20} color="white" />
                                    <Text style={styles.btnText}>Chat con Conductor</Text>
                                </TouchableOpacity>
                            )}
                        </View>
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

            {status === 'ON_RIDE' && role === Roles.USER && (
                <View style={styles.bottomContainer}>
                    <View style={styles.confirmCard}>
                        <Text style={[styles.statusLabel, { color: '#10B981' }]}>EL CONDUCTOR ESTÁ EN CAMINO</Text>
                        <View style={styles.clientInfoRow}>
                            <Ionicons name="car" size={24} color="#10B981" />
                            <Text style={styles.clientNameText}>
                                Tu conductor llegará pronto
                            </Text>
                        </View>
                        <Text style={{ textAlign: 'center', marginTop: 15, color: '#6B7280' }}>
                            Proporciona este código al conductor:
                        </Text>
                        <Text style={{ textAlign: 'center', fontSize: 32, fontWeight: 'bold', color: '#1E3A8A', marginTop: 5, letterSpacing: 10 }}>
                            {optValue || otpCode}
                        </Text>

                        {isChatEnabledRideStatus(activeRideBackendStatus) && (
                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#10B981', marginTop: 15, flexDirection: 'row', justifyContent: 'center', gap: 10 }]}
                                onPress={() => setIsChatVisible(true)}
                            >
                                <Ionicons name="chatbubbles" size={20} color="white" />
                                <Text style={styles.btnText}>Chat con Conductor</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}


            <ChatModal
                visible={isChatVisible}
                onClose={() => setIsChatVisible(false)}
                socket={socket.current}
                rideId={currentRideId}
                userId={userId}
                initialMessages={initialChatMessages}
            />

            <RatingModal
                visible={ratingModalVisible}
                onSend={handleSendRating}
                driverName={driverInfo?.name}
            />
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
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 12,
        zIndex: 1000,
        overflow: 'visible',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 2,
    },
    searchDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#1D4ED8',
        marginTop: 16,
        marginRight: 10,
        marginLeft: 2,
        flexShrink: 0,
    },
    searchDotDestination: {
        backgroundColor: '#EF4444',
    },
    searchDivider: {
        width: 2,
        height: 10,
        backgroundColor: '#E5E7EB',
        marginLeft: 8,
    },
    searchInput: {
        height: 44,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#374151',
    },
    searchHint: {
        fontSize: 11,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 2,
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
