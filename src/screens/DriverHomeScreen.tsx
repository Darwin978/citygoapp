import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Switch, Image, Platform, Modal, TextInput, KeyboardAvoidingView, Linking, AppState, DeviceEventEmitter } from 'react-native';
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
import { cancelSolicitudApi, driverCancelRideApi, getActiveRideApi, getRideByIdApi, getPriceApi, requestRideApi } from '../../utils/services/ridesServices';
import MapZoomControls from '../components/MapZoomControls';
import { updateStatusDriverApi } from '../../utils/services/userService';
import ChatModal from '../components/ChatModal';
import { isActiveBackendRideStatus, isChatEnabledRideStatus, isTripInProgress, mapBackendStatusToDriverScreen } from '../../utils/services/rideFlow';
import { useCustomAlert } from '../../utils/context/AlertContext';
import notifee, { EventType } from '@notifee/react-native';
import { startKeepAlive, stopKeepAlive } from '../../utils/services/keepAlive';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBfVCCME9FaQG7zUd0xbeAQDehrYnFrpZA';
const SOCKET_URL = BACKEND_URL; // Tu backend NestJS
const ACCEPT_RIDE_ACTION_ID = 'accept_ride';

export default function DriverHomeScreen({ onOffline }: { onOffline?: () => void }) {
    const { showAlert } = useCustomAlert();
    const insets = useSafeAreaInsets();
    const [userId, setUserId] = useState<string | null>(null);
    const [region, setRegion] = useState<any>(null);
    const [isOnline, setIsOnline] = useState(false);
    const isOnlineRef = useRef(isOnline);
    useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
    const [status, setStatus] = useState<'IDLE' | 'PICKUP' | 'DESTINATION' | 'ROUTE' | 'SEARCHING' | 'ON_RIDE' | 'REQUESTED' | 'ACCEPTED' | 'TO_PICKUP' | 'IN_PROGRESS' | 'TO_RATING' | 'COMPLETED' | 'CANCELLED'>('PICKUP');
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
    const currentRideIdRef = useRef<string | null>(null);
    useEffect(() => { currentRideIdRef.current = currentRideId; }, [currentRideId]);

    // Solicitudes de Viaje (Conductor)
    const [availableRequests, setAvailableRequests] = useState<any[]>([]);
    const [showRequestDialog, setShowRequestDialog] = useState<boolean>(false);
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [activeRequestRide, setActiveRequestRide] = useState<any>(null);
    const [reference, setReference] = useState('');
    const [searchingTimeLeft, setSearchingTimeLeft] = useState(60);
    const [driverTimeLeft, setDriverTimeLeft] = useState(60);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpValidate, setOtpValidate] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [initialChatMessages, setInitialChatMessages] = useState<any[]>([]);
    const [activeRideBackendStatus, setActiveRideBackendStatus] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!currentRideId) {
            setUnreadCount(0);
        }
    }, [currentRideId]);

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

    const [isManualZoom, setIsManualZoom] = useState(false);
    const zoomLevel = useRef(15);

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

            socket.current.on('connect', async () => {
                console.log("✅ Conectado al servidor de CityGo con ID:", socket.current.id);

                if (role === Roles.DRIVER) {
                    console.log("Ingresa a getAvailableRides");
                    socket.current.emit('getAvailableRides', (rides: any[]) => {
                        setAvailableRequests(rides);
                    });
                }

                const activeRideId = currentRideIdRef.current || await AsyncStorage.getItem('activeRideId');
                if (activeRideId) {
                    socket.current.emit('joinRide', activeRideId);
                }
            });

            socket.current.on('newRideRequest', async (req: any) => {
                console.log("Nueva solicitud de viaje:", req);

                // NOTA: la notificación (sonido + vibración + Full Screen Intent) ya la
                // muestra App.tsx a través del handler onMessage de Firebase.
                // Aquí solo actualizamos el estado de la UI para mostrar el diálogo.

                setAvailableRequests(prevRequests => {
                    const reqExists = prevRequests.some(r => r.tripId === req.tripId);
                    if (reqExists) return prevRequests;
                    return [...prevRequests, req];
                });

                // Opcional: mostrar el diálogo solo para la más reciente
                setPendingRequest(req);
                setShowRequestDialog(true);

                // Traer la app al frente para mostrar el modal sobre otras apps
                if (Platform.OS === 'android') {
                    Linking.openURL('citygo://').catch(err => console.log('Error opening app:', err));
                }
            });

            socket.current.on('trip_accepted', (data: any) => {
                socket.current.emit('joinRide', data.rideId);
                setDriverInfo(data.driver);
                setStatus('ON_RIDE'); // Sugerencia: Usa ACCEPTED antes de ON_RIDE
                showAlert("¡Conductor asignado!", `${data.driverName} va en camino.`);
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
                    showAlert("Viaje no disponible", "Otro conductor ha aceptado esta carrera.");
                }
            });

            socket.current.on('trip_completed_success', async () => {
                // 1. Limpiar persistencia
                await AsyncStorage.removeItem('activeRideId');

                // 2. Resetear estados de la UI
                setCurrentRideId(null);
                setActiveRideBackendStatus(null);
                setPendingRequest(null);
                setInitialChatMessages([]);
                setStatus('IDLE'); // O 'PICKUP' según tu enum inicial

                showAlert("Viaje Finalizado", "Ya puedes recibir nuevas solicitudes.");

                setReference('');

                if (!isOnlineRef.current && onOffline) {
                    onOffline();
                }
            });

            socket.current.on('ride_timeout', async (data: any) => {
                console.log("Ride timeout event received on driver screen:", data);

                if (!isOnlineRef.current) {
                    showAlert("Viaje no aceptado", data.message || "No se encontraron conductores. Por favor, vuelve a solicitar la carrera.");
                    setCurrentRideId(null);
                    setActiveRequestRide(null);
                    setPendingRequest(null);
                    setDriverInfo(null);
                    setOtpValidate(false);
                    setInitialChatMessages([]);
                    setActiveRideBackendStatus(null);
                    setUnreadCount(0);
                    await AsyncStorage.removeItem('activeRideId');
                    setStatus('ROUTE'); // Volver a la pantalla de confirmación
                    setReference('');
                } else {
                    setAvailableRequests(prev => prev.filter(r => r.tripId !== data.rideId));
                    if (pendingRequest?.tripId === data.rideId) {
                        setShowRequestDialog(false);
                        setPendingRequest(null);
                    }
                }
            });

            socket.current.on('driver_arrived', (data: any) => {
                setStatus('ON_RIDE'); // Sugerencia: Usa ACCEPTED antes de ON_RIDE
                showAlert("¡Conductor Llegando!", `El conductoe llego a recogerte, sal ahora!`);
            });

            socket.current.on('ride_finished', async (data: any) => {
                // 1. Limpiar persistencia
                await AsyncStorage.removeItem('activeRideId');

                // 2. Resetear estados
                setCurrentRideId(null);
                setActiveRideBackendStatus(null);
                setStatus('IDLE');

                // 3. Mostrar resumen (Podrías navegar a una pantalla de Rating/Calificación)
                showAlert(
                    "¡Llegamos!",
                    `${data.finalPrice}`
                );

                setReference('');

                if (!isOnlineRef.current && onOffline) {
                    onOffline();
                }
            });

        };

        connectSocket();

        return () => {
            isMounted = false;
            if (socket.current) socket.current.disconnect();
        };

    }, [userId, role]);

    const waitForSocketReady = async (timeoutMs = 2500) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < timeoutMs) {
            if (socket.current?.connected) return true;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return Boolean(socket.current?.connected);
    };

    const buildPendingRequestFromRide = (rideId: string, response: any) => ({
        tripId: rideId,
        clientName: response.rideData?.clientName || 'Pasajero',
        originAddress: response.rideData?.originAddress || '',
        destinationAddress: response.rideData?.destAddress || '',
        price: response.rideData?.finalPrice ?? 0,
        distance: response.rideData?.distance || '',
        reference: response.rideData?.reference || '',
        createdAt: response.rideData?.createdAt || response.ride?.createdAt || null,
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'SEARCHING') {
            const calculateInitialTime = () => {
                let initialTime = 60;
                if (activeRequestRide?.ride?.createdAt) {
                    const createdTime = new Date(activeRequestRide.ride.createdAt).getTime();
                    const diffSeconds = Math.floor((Date.now() - createdTime) / 1000);
                    initialTime = Math.max(0, 60 - diffSeconds);
                }
                setSearchingTimeLeft(initialTime);
            };
            calculateInitialTime();

            interval = setInterval(() => {
                setSearchingTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setSearchingTimeLeft(60);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, activeRequestRide]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showRequestDialog && pendingRequest) {
            const calculateTime = () => {
                const createdTime = pendingRequest.createdAt ? new Date(pendingRequest.createdAt).getTime() : Date.now();
                const diffSeconds = Math.floor((Date.now() - createdTime) / 1000);
                const remaining = Math.max(0, 60 - diffSeconds);
                setDriverTimeLeft(remaining);
                if (remaining <= 0) {
                    setShowRequestDialog(false);
                }
            };
            calculateTime();

            interval = setInterval(() => {
                setDriverTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setShowRequestDialog(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showRequestDialog, pendingRequest]);

    const hydrateActiveRide = async (rideId: string, response: any, openChat = false) => {
        await AsyncStorage.setItem('activeRideId', rideId);
        setCurrentRideId(rideId);
        setActiveRideBackendStatus(response.status);
        setInitialChatMessages(response.rideData.messages || []);
        setPendingRequest(buildPendingRequestFromRide(rideId, response));
        setActiveRequestRide({
            ...response,
            ride: {
                originLat: response.rideData.pickupCoords.lat,
                originLng: response.rideData.pickupCoords.lng,
                destLat: response.rideData.destCoords.lat,
                destLng: response.rideData.destCoords.lng,
                originAddress: response.rideData.originAddress,
                destinationAddress: response.rideData.destAddress,
            }
        });
        setShowRequestDialog(false);
        setAvailableRequests(prev => prev.filter(request => request.tripId !== rideId));
        socket.current?.emit('joinRide', rideId);
        setOtpValidate(isTripInProgress(response.status));
        setStatus(mapBackendStatusToDriverScreen(response.status) as any);
        if (openChat) {
            setUnreadCount(0);
            setIsChatVisible(true);
        }
    };

    const acceptRideByRestAndHydrate = async (rideId: string) => {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) throw new Error('NO_AUTH_TOKEN');

        const acceptResponse = await fetch(`${BACKEND_URL}/ride/${rideId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });

        const acceptResult = await acceptResponse.json().catch(() => null);
        if (!acceptResponse.ok || acceptResult?.status !== 'success') {
            throw new Error(acceptResult?.message || 'ACCEPT_RIDE_ERROR');
        }

        const rideResponse = await getRideByIdApi(rideId);
        if (rideResponse?.rideData && isActiveBackendRideStatus(rideResponse.status) && rideResponse.status !== 'TO_RATING') {
            await hydrateActiveRide(rideId, rideResponse);
        }
    };

    const acceptRideRequest = async (request: any) => {
        if (!request?.tripId || !userId) return;

        setPendingRequest(request);
        setLoading(true);

        const socketReady = await waitForSocketReady();
        if (!socketReady) {
            setLoading(false);
            setShowRequestDialog(true);
            showAlert('Conexión en curso', 'Toca Aceptar cuando CityGo termine de reconectar.');
            return;
        }

        socket.current.emit('accept_trip', { tripId: request.tripId, userId }, async (response: any) => {
            setLoading(false);
            console.log("triId", request.tripId);
            console.log("Respuesta de la API:", response);
            if (response.status === 'success') {
                await AsyncStorage.setItem('activeRideId', request.tripId);
                setCurrentRideId(request.tripId);
                setActiveRideBackendStatus('ACCEPTED');
                console.log("requestRide original", response.data);
                setActiveRequestRide(response.data);
                setAvailableRequests([]);
                setShowRequestDialog(false);
                setStatus('ON_RIDE');
                if (myLocation) {
                    socket.current.emit('updateLocation', { rideId: request.tripId, coords: myLocation });
                }

                socket.current.emit('joinRide', request.tripId);

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
    };

    const restoreSession = async () => {
        // ── Leer contexto guardado por la notificación ───────────────────
        const savedRideId = await AsyncStorage.getItem('activeRideId');
        const notifType = await AsyncStorage.getItem('pendingNotifType');
        const notifAction = await AsyncStorage.getItem('pendingNotifAction');
        await AsyncStorage.removeItem('pendingNotifType'); // consumir una sola vez
        await AsyncStorage.removeItem('pendingNotifAction'); // consumir una sola vez

        // ── Caso 0: notificación de MENSAJE → abrir chat si la carrera sigue activa ─
        if (notifType === 'MESSAGE' && savedRideId) {
            try {
                const response = await getRideByIdApi(savedRideId);
                if (response?.rideData && isChatEnabledRideStatus(response.status)) {
                    await hydrateActiveRide(savedRideId, response, true);
                }
            } catch (_e) { /* silenciar */ }
            return;
        }

        // ── Caso 1: el conductor abrió el app tocando una notif NEW_RIDE ─
        // La carrera está en REQUESTED → el conductor NO está asignado aún,
        // por eso getActiveRideApi() devuelve IDLE y no sirve aquí.
        // Usamos getRideByIdApi(rideId) que obtiene la carrera por ID directo.
        if (notifType === 'NEW_RIDE' && savedRideId) {
            try {
                const response = await getRideByIdApi(savedRideId);
                if (response?.rideData && isActiveBackendRideStatus(response.status) && response.status !== 'TO_RATING' && response.status !== 'REQUESTED') {
                    await hydrateActiveRide(savedRideId, response);
                    return;
                }

                if (response?.status === 'REQUESTED' && response?.rideData) {
                    const req = buildPendingRequestFromRide(savedRideId, response);
                    setPendingRequest(req);
                    if (notifAction === ACCEPT_RIDE_ACTION_ID) {
                        try {
                            await acceptRideByRestAndHydrate(savedRideId);
                        } catch (_e) {
                            await acceptRideRequest(req);
                        }
                    } else {
                        setShowRequestDialog(true);
                    }
                    return; // no seguir con la restauración de viaje activo
                }
                // Si ya fue aceptada por otro conductor, limpiar y salir
                await AsyncStorage.removeItem('activeRideId');
            } catch (e) {
                console.log('[restoreSession] Error al obtener carrera por ID:', e);
            }
            return;
        }

        // ── Caso 2: restaurar un viaje activo (ACCEPTED, IN_PROGRESS…) ──
        try {
            const response = await getActiveRideApi();
            if (!response?.rideData || !isActiveBackendRideStatus(response.status) || response.status === 'TO_RATING' || response.status === 'REQUESTED') {
                await AsyncStorage.removeItem('activeRideId');
                // Limpiar la interfaz del conductor si el viaje no está activo
                setCurrentRideId(null);
                setActiveRideBackendStatus(null);
                return;
            }

            const activeRideId = response.rideData.tripId;
            await hydrateActiveRide(activeRideId, response);
        } catch (error) {
            // Fallback vía socket si el REST falla
            if (savedRideId && socket.current) {
                socket.current.emit('getRideStatus', { rideId: savedRideId }, async (response: any) => {
                    if (!response?.rideData || !isActiveBackendRideStatus(response.status) || response.status === 'TO_RATING' || response.status === 'REQUESTED') {
                        AsyncStorage.removeItem('activeRideId');
                        return;
                    }
                    await hydrateActiveRide(savedRideId, response);
                });
            }
        }
    };

    useEffect(() => {
        if (!userId) return;
        restoreSession();
    }, [userId]);

    // Escuchar si el conductor acepta la carrera desde el banner/notificación nativa
    useEffect(() => {
        const acceptSub = DeviceEventEmitter.addListener('RIDE_ACCEPTED_FROM_NOTIF', async ({ rideId }) => {
            console.log('[DriverHomeScreen] Evento RIDE_ACCEPTED_FROM_NOTIF recibido:', rideId);
            try {
                const response = await getRideByIdApi(rideId);
                if (response?.rideData && isActiveBackendRideStatus(response.status)) {
                    await hydrateActiveRide(rideId, response);
                }
            } catch (err) {
                console.error('[DriverHomeScreen] Error procesando RIDE_ACCEPTED_FROM_NOTIF:', err);
            }
        });

        return () => {
            acceptSub.remove();
        };
    }, [userId]);

    // Escuchar si el conductor rechaza la carrera desde el banner/notificación nativa
    useEffect(() => {
        const rejectSub = DeviceEventEmitter.addListener('RIDE_REJECTED_FROM_NOTIF', ({ rideId }) => {
            console.log('[DriverHomeScreen] Evento RIDE_REJECTED_FROM_NOTIF recibido:', rideId);
            setAvailableRequests(prev => prev.filter(r => r.tripId !== rideId));
            if (pendingRequest?.tripId === rideId) {
                setShowRequestDialog(false);
                setPendingRequest(null);
            }
        });

        return () => {
            rejectSub.remove();
        };
    }, [pendingRequest]);

    // Actualizar la pantalla cuando la app regrese de segundo plano a primer plano
    useEffect(() => {
        const appStateSub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && userId) {
                console.log('[DriverHomeScreen] App volvió a primer plano. Sincronizando estado...');
                restoreSession();
            }
        });

        return () => {
            appStateSub.remove();
        };
    }, [userId]);

    // ── Deep link en vivo: citygo://ride/{rideId} ─────────────────────────────
    // NOTA: onForegroundEvent de notifee está centralizado en App.tsx.
    // Cuando el conductor toca una notif con la app abierta, App.tsx hace
    // Linking.openURL → este listener recibe la URL y muestra el diálogo.
    useEffect(() => {
        const handleUrl = async ({ url }: { url: string }) => {
            if (!url.startsWith('citygo://ride/')) return;
            const rideId = url.replace('citygo://ride/', '');
            if (!rideId) return;
            await AsyncStorage.setItem('activeRideId', rideId);

            const notifType = await AsyncStorage.getItem('pendingNotifType');
            const notifAction = await AsyncStorage.getItem('pendingNotifAction');
            await AsyncStorage.removeItem('pendingNotifType');
            await AsyncStorage.removeItem('pendingNotifAction');

            try {
                const response = await getRideByIdApi(rideId);
                if (!response?.rideData) return;

                if (notifType === 'MESSAGE' && isChatEnabledRideStatus(response.status)) {
                    await hydrateActiveRide(rideId, response, true);
                    return;
                }

                if (isActiveBackendRideStatus(response.status) && response.status !== 'TO_RATING' && response.status !== 'REQUESTED') {
                    await hydrateActiveRide(rideId, response);
                    return;
                }

                if (response.status === 'REQUESTED') {
                    const req = buildPendingRequestFromRide(rideId, response);
                    setPendingRequest(req);
                    if (notifAction === ACCEPT_RIDE_ACTION_ID) {
                        try {
                            await acceptRideByRestAndHydrate(rideId);
                        } catch (_e) {
                            await acceptRideRequest(req);
                        }
                    } else {
                        setShowRequestDialog(true);
                    }
                }
            } catch (_e) { /* silenciar */ }
        };

        const subscription = Linking.addEventListener('url', handleUrl);
        return () => subscription.remove();
    }, []);

    // 2. Obtener ubicación inicial y Rol
    useEffect(() => {
        (async () => {
            try {
                const savedRole = await AsyncStorage.getItem('role');
                setRole(savedRole);
                if (savedRole === Roles.DRIVER) {
                    handleChangeStatusDriver(true);
                }

                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const applyLocation = (loc: Location.LocationObject) => {
                    const { latitude, longitude, heading } = loc.coords;
                    setRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
                    setMyLocation({ latitude, longitude, heading: heading || 0 });
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

                        // --- NUEVA LÓGICA DE CÁMARA ---
                        if (isManualZoom) {
                            // Si movió el zoom, solo centramos manteniendo su zoomLevel.current
                            mapRef.current?.animateCamera({
                                center: coords,
                                zoom: zoomLevel.current
                            }, { duration: 1000 });
                        } else {
                            // Si no, podemos dejar que siga el flujo automático (fitToCoordinates)
                        }
                    }
                );
            })();
        }
        return () => locationWatcher?.remove();
    }, [isOnline, currentRideId, isManualZoom]);

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

    const handleChangeStatusDriver = async (onlineStatus: boolean) => {
        setIsOnline(onlineStatus);
        await updateStatusDriverApi(onlineStatus);
        if (onlineStatus) {
            startKeepAlive(); // ← mantener proceso vivo mientras el conductor está disponible
        } else {
            if (['IDLE', 'PICKUP', 'DESTINATION', 'ROUTE', 'SEARCHING'].includes(status)) {
                stopKeepAlive(); // ← detener el servicio solo si no hay carrera activa
                if (onOffline) onOffline();
            } else {
                showAlert('Modo Cliente', 'Pasarás a la vista de cliente al terminar tu carrera actual.');
            }
        }
    }

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
        setReference('');
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
                finalPrice: paymentMethod === 'CARD' ? parseFloat((price / 0.9425).toFixed(2)) : price,
                paymentMethod,
                reference: reference.trim() || undefined,
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
        setOtpValidate(false);
        if (!pendingRequest) return;
        await acceptRideRequest(pendingRequest);
    };

    const handleArrivedAtPickup = () => {
        if (!currentRideId) return;

        // Notificamos al backend que el conductor está en la puerta
        socket.current.emit('driver_arrived', { rideId: currentRideId });
        setActiveRideBackendStatus('DRIVER_ARRIVED');

        showAlert(
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
                setActiveRideBackendStatus('IN_PROGRESS');

                // IMPORTANTE: Al pasar a ON_RIDE y haber validado el código, 
                // el MapViewDirections ahora usará destinationCoords automáticamente
                setStatus('ON_RIDE');

                // Retrasamos la alerta ligeramente para que la animación de cierre del Modal termine y no la tape
                setTimeout(() => {
                    showAlert("¡Viaje Iniciado!", "Dirígete al destino final.");
                }, 400);
            } else {
                setOtpValidate(false);
                setOtpCode('');
                showAlert("Código Incorrecto", "El código no coincide. Verifica con el pasajero.");
            }
        });
    };

    const handleFinishRide = () => {
        showAlert(
            "Finalizar Viaje",
            "¿Confirmas que has llegado al destino y deseas finalizar la carrera?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Finalizar", style: "destructive", onPress: () => {
                        if (currentRideId) {
                            socket.current.emit('finish_trip', { rideId: currentRideId });
                        }
                        showAlert("¡Viaje Finalizado!", "El viaje ha concluido con éxito.");
                        setStatus('PICKUP');
                        setCurrentRideId(null);
                        setActiveRideBackendStatus(null);
                        setActiveRequestRide(null);
                        setPendingRequest(null);
                        setOtpValidate(false);
                        setInitialChatMessages([]);
                        AsyncStorage.removeItem('activeRideId');
                    }
                }
            ]
        );
    };

    const handleDriverCancelRide = () => {
        showAlert(
            "Cancelar carrera",
            "¿Estás seguro de que deseas cancelar esta carrera? El pasajero será notificado.",
            [
                { text: "No, continuar", style: "cancel" },
                {
                    text: "Sí, cancelar", style: "destructive", onPress: async () => {
                        if (!currentRideId) return;
                        try {
                            await driverCancelRideApi(currentRideId);
                        } catch (e) {
                            // El backend puede fallar si el estado cambió; seguimos limpiando la UI
                            console.warn('[CancelRide] Error en API:', e);
                        }
                        setStatus('PICKUP');
                        setCurrentRideId(null);
                        setActiveRideBackendStatus(null);
                        setActiveRequestRide(null);
                        setPendingRequest(null);
                        setOtpValidate(false);
                        setShowRequestDialog(false);
                        setInitialChatMessages([]);
                        await AsyncStorage.removeItem('activeRideId');
                        showAlert("Carrera cancelada", "Ya puedes recibir nuevas solicitudes.");
                    }
                }
            ]
        );
    };

    const handleNavigateToPickup = () => {
        const lat = activeRequestRide?.ride?.originLat;
        const lng = activeRequestRide?.ride?.originLng;
        if (lat && lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            Linking.openURL(url).catch(() => showAlert('Error', 'No se pudo abrir la aplicación de mapas.'));
        }
    };

    const handleNavigateToDestination = () => {
        const lat = activeRequestRide?.ride?.destLat;
        const lng = activeRequestRide?.ride?.destLng;
        if (lat && lng) {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            Linking.openURL(url).catch(() => showAlert('Error', 'No se pudo abrir la aplicación de mapas.'));
        }
    };

    const handleZoomIn = async () => {
        if (!mapRef.current) return;
        setIsManualZoom(true);

        const camera = await mapRef.current?.getCamera();
        if (camera) {
            const newZoom = (camera.zoom || 15) + 1;
            zoomLevel.current = newZoom;
            camera.zoom = newZoom;
            mapRef.current?.animateCamera(camera, { duration: 300 });
        }
    };

    const handleZoomOut = async () => {
        setIsManualZoom(true);
        const camera = await mapRef.current?.getCamera();
        if (camera) {
            const newZoom = (camera.zoom || 15) - 1;
            zoomLevel.current = newZoom; // Guardamos el nuevo zoom
            camera.zoom = newZoom;
            mapRef.current?.animateCamera(camera, { duration: 300 });
        }
    };

    // 2. Función para volver al modo automático
    const handleRecenter = () => {
        setIsManualZoom(false);
        // Aquí puedes disparar un fitToCoordinates para resetear la vista
        if (routeDetails) {
            mapRef.current?.fitToCoordinates(routeDetails.coordinates, {
                edgePadding: { top: 80, right: 50, bottom: 320, left: 50 }
            });
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
                    const currentZoom = Math.round(Math.log(360 / region.longitudeDelta) / Math.LN2);
                    zoomLevel.current = currentZoom;
                    if (details?.isGesture) {
                        if (status === 'PICKUP' || status === 'IDLE') {
                            getAddressFromCoords(reg.latitude, reg.longitude, true);
                        } else if (status === 'DESTINATION') {
                            getAddressFromCoords(reg.latitude, reg.longitude, false);
                        }
                    }
                }}
            >

                {/* Marcador del propio Conductor (Cuando está Online) */}
                {role === Roles.DRIVER && isOnline && myLocation && (
                    <Marker
                        key="my-car"
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
                {pickupCoords && <Marker key="pickup" coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={20} color="#1D4ED8" /></Marker>}
                {destinationCoords && <Marker key="destination" coordinate={destinationCoords} anchor={{ x: 0.5, y: 1 }}><Ionicons name="location" size={40} color="#EF4444" /></Marker>}

                {/* Ruta para Usuario en MODE_RIDE */}
                {(status === 'DESTINATION' || status === 'SEARCHING') && pickupCoords && destinationCoords && role === Roles.USER && (
                    <MapViewDirections
                        key={`route-${currentRideId}-${otpValidate}`}
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


                {/* Renderizado de Rutas Inteligente */}
                {(
                    (status === 'ROUTE' && pickupCoords && destinationCoords) ||
                    (status === 'ON_RIDE' && activeRequestRide && myLocation)
                ) && (
                        <MapViewDirections
                            key={`route-${currentRideId}-${otpValidate}`}
                            origin={
                                status === 'ON_RIDE'
                                    ? myLocation
                                    : pickupCoords!
                            }
                            destination={
                                status === 'ON_RIDE'
                                    ? (!otpValidate
                                        ? { latitude: activeRequestRide.ride?.originLat || 0, longitude: activeRequestRide.ride?.originLng || 0 }
                                        : { latitude: activeRequestRide.ride?.destLat || 0, longitude: activeRequestRide.ride?.destLng || 0 })
                                    : destinationCoords!
                            }
                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={5}
                            strokeColor={status === 'ON_RIDE' ? "#10B981" : "#1D4ED8"}
                            onReady={res => {
                                setRouteDetails(res);
                                mapRef.current?.fitToCoordinates(res.coordinates, {
                                    edgePadding: { top: 80, right: 50, bottom: 320, left: 50 }
                                });
                            }}
                        />
                    )}

                {status === 'ON_RIDE' && role === Roles.DRIVER && activeRequestRide?.ride?.originLat && !otpValidate && (
                    <Marker
                        key={`pickup-${activeRequestRide.tripId}`}
                        coordinate={{
                            latitude: activeRequestRide.ride.originLat,
                            longitude: activeRequestRide.ride.originLng
                        }}
                        title="Recoger aquí"
                    >
                        <View style={styles.pickupMarkerContainer}>
                            <Ionicons name="person-circle" size={40} color="#4e504fff" />
                        </View>
                    </Marker>
                )}

                {status === 'ON_RIDE' && role === Roles.DRIVER && activeRequestRide?.ride?.destLat && otpValidate && (
                    <Marker
                        key={`destination-${activeRequestRide.tripId}`}
                        coordinate={{
                            latitude: activeRequestRide.ride.destLat,
                            longitude: activeRequestRide.ride.destLng
                        }}
                    >
                        <Ionicons name="location" size={40} color="#EF4444" />
                    </Marker>
                )}

                {isManualZoom && (
                    <TouchableOpacity
                        style={styles.recenterButton}
                        onPress={() => setIsManualZoom(false)}
                    >
                        <Ionicons name="locate" size={24} color="white" />
                        <Text style={{ color: 'white' }}>Auto-Zoom</Text>
                    </TouchableOpacity>
                )}
            </MapView>

            {/*<MapZoomControls
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onRecenter={handleRecenter}
                isManualZoom={isManualZoom}
            />
             Driver Interface - Online Toggle */}
            {role === Roles.DRIVER && (isOnline || (status !== 'ROUTE' && status !== 'SEARCHING')) && (
                <View style={[styles.driverInterface, { top: insets.top + (isOnline ? 10 : 150), zIndex: isOnline ? 2000 : 900 }]}>
                    <View style={styles.statusCard}>
                        <Text style={styles.statusText}>{isOnline ? 'EN LÍNEA' : 'FUERA DE LÍNEA'}</Text>
                        <Switch
                            value={isOnline}
                            onValueChange={handleChangeStatusDriver}
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
                            description: { color: '#000000' },
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
                            description: { color: '#000000' },
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

            {/* Soporte WhatsApp */}
            <TouchableOpacity
                style={[styles.whatsappSupportBtn, { bottom: insets.bottom + 160 }]}
                onPress={() => {
                    const url = "https://wa.me/+593995580333/?text=Hola%20necesito%20soporte%20con%20mi%20app%20CityGo";
                    Linking.openURL(url);
                }}
            >
                <Ionicons name="logo-whatsapp" size={28} color="white" />
            </TouchableOpacity>

            {/* Botón de Acción Principal / Card de Precio */}
            <View style={[styles.bottomContainer, { bottom: insets.bottom + 0 }]}>
                {status === 'SEARCHING' ? (
                    <View style={styles.searchingCard}>
                        <ActivityIndicator size="large" color="#1D4ED8" style={{ marginBottom: 15 }} />
                        <Text style={styles.searchingTitle}>Buscando conductor...</Text>
                        <Text style={styles.searchingSubtext}>Notificando a los conductores cercanos a tu punto de recogida.</Text>

                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${(searchingTimeLeft / 60) * 100}%` }]} />
                        </View>
                        <Text style={styles.countdownText}>Tiempo restante: {searchingTimeLeft} seg</Text>

                        <TouchableOpacity
                            style={styles.btnCancelSearch}
                            onPress={() => handleCancelSolicitud()}
                        >
                            <Text style={styles.btnCancelSearchText}>Cancelar viaje GO!</Text>
                        </TouchableOpacity>
                    </View>
                ) : status === 'ROUTE' ? (
                    <View style={styles.confirmCard}>
                        {/* Display Cash and Card price dynamically */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <View>
                                <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>Efectivo</Text>
                                <Text style={[styles.priceText, paymentMethod === 'CARD' && { color: '#9CA3AF', fontSize: 24 }]}>
                                    ${(price || 0).toFixed(2)}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>Tarjeta</Text>
                                <Text style={[styles.priceText, paymentMethod === 'CASH' && { color: '#9CA3AF', fontSize: 24 }]}>
                                    ${((price || 0) / 0.9425).toFixed(2)}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.distanceText}>{distance}</Text>
                        <Text style={styles.timeText}>{error ? error : time}</Text>

                        {/* Referencia de ubicación (Opcional) */}
                        <TextInput
                            style={styles.referenceInput}
                            placeholder="Referencia de ubicación (Ej: casa negra, portón rojo)"
                            placeholderTextColor="#9CA3AF"
                            value={reference}
                            onChangeText={setReference}
                        />

                        {/* Opciones de Pago */}
                        <View style={styles.paymentContainer}>
                            <TouchableOpacity
                                style={[styles.paymentBtn, paymentMethod === 'CASH' && styles.paymentBtnActive]}
                                onPress={() => setPaymentMethod('CASH')}
                            >
                                <Ionicons name="cash-outline" size={20} color={paymentMethod === 'CASH' ? 'white' : '#1D4ED8'} />
                                <Text style={[styles.paymentText, paymentMethod === 'CASH' && styles.paymentTextActive]}>
                                    Efectivo (${(price || 0).toFixed(2)})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.paymentBtn, paymentMethod === 'CARD' && styles.paymentBtnActive]}
                                onPress={() => setPaymentMethod('CARD')}
                            >
                                <Ionicons name="card-outline" size={20} color={paymentMethod === 'CARD' ? 'white' : '#1D4ED8'} />
                                <Text style={[styles.paymentText, paymentMethod === 'CARD' && styles.paymentTextActive]}>
                                    Tarjeta (${((price || 0) / 0.9425).toFixed(2)})
                                </Text>
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

                        {/* Barra de progreso de expiración para el conductor */}
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${(driverTimeLeft / 60) * 100}%`, backgroundColor: '#EF4444' }]} />
                        </View>
                        <Text style={{ textAlign: 'center', color: '#EF4444', fontWeight: 'bold', marginBottom: 10 }}>
                            Expiración en: {driverTimeLeft}s
                        </Text>

                        <View style={{ marginBottom: 10, marginTop: 10 }}>
                            <Text style={{ fontWeight: 'bold', color: '#1E3A8A' }}>Recogida:</Text>
                            <Text style={{ color: '#6B7280' }}>{pendingRequest.originAddress || 'Cargando...'}</Text>
                        </View>

                        {pendingRequest.reference ? (
                            <View style={{ marginBottom: 10, padding: 8, backgroundColor: '#FFF1F2', borderRadius: 8, borderWidth: 1, borderColor: '#FFE4E6' }}>
                                <Text style={{ fontSize: 13, color: '#9F1239', fontWeight: 'bold' }}>
                                    Referencia: <Text style={{ fontWeight: 'normal', color: '#4B5563' }}>{pendingRequest.reference}</Text>
                                </Text>
                            </View>
                        ) : null}

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

                        {pendingRequest?.reference ? (
                            <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FFF1F2', borderRadius: 8, borderWidth: 1, borderColor: '#FFE4E6', marginBottom: 10 }}>
                                <Text style={{ fontSize: 13, color: '#9F1239', fontWeight: 'bold' }}>
                                    Referencia de ubicación: <Text style={{ fontWeight: 'normal', color: '#4B5563' }}>{pendingRequest.reference}</Text>
                                </Text>
                            </View>
                        ) : null}

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#3B82F6', flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={handleNavigateToPickup}
                            >
                                <Ionicons name="navigate" size={20} color="white" />
                                <Text style={styles.btnText}>NAVEGAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#10B981', flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={handleArrivedAtPickup}
                            >
                                <Ionicons name="checkmark-circle" size={20} color="white" />
                                <Text style={styles.btnText}>LLEGUÉ</Text>
                            </TouchableOpacity>
                        </View>

                        {isChatEnabledRideStatus(activeRideBackendStatus) && (
                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#1D4ED8', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={() => {
                                    setUnreadCount(0);
                                    setIsChatVisible(true);
                                }}
                            >
                                <View style={{ position: 'relative' }}>
                                    <Ionicons name="chatbubbles" size={20} color="white" />
                                    {unreadCount > 0 && (
                                        <View style={styles.chatBadgeCount}>
                                            <Text style={styles.chatBadgeText}>{unreadCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.btnText}>CHAT CON PASAJERO</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.btnCancelSearch, { marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                            onPress={handleDriverCancelRide}
                        >
                            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                            <Text style={[styles.btnCancelSearchText, { color: '#EF4444' }]}>CANCELAR CARRERA</Text>
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

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#3B82F6', flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={handleNavigateToDestination}
                            >
                                <Ionicons name="navigate" size={20} color="white" />
                                <Text style={styles.btnText}>NAVEGAR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#EF4444', flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={handleFinishRide}
                            >
                                <Ionicons name="flag" size={20} color="white" />
                                <Text style={styles.btnText}>FINALIZAR</Text>
                            </TouchableOpacity>
                        </View>

                        {isChatEnabledRideStatus(activeRideBackendStatus) && (
                            <TouchableOpacity
                                style={[styles.btnConfirm, { backgroundColor: '#1D4ED8', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                onPress={() => {
                                    setUnreadCount(0);
                                    setIsChatVisible(true);
                                }}
                            >
                                <View style={{ position: 'relative' }}>
                                    <Ionicons name="chatbubbles" size={20} color="white" />
                                    {unreadCount > 0 && (
                                        <View style={styles.chatBadgeCount}>
                                            <Text style={styles.chatBadgeText}>{unreadCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.btnText}>CHAT CON PASAJERO</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.btnCancelSearch, { marginTop: 8, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                            onPress={handleDriverCancelRide}
                        >
                            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                            <Text style={[styles.btnCancelSearchText, { color: '#EF4444' }]}>CANCELAR CARRERA</Text>
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

            <ChatModal
                visible={isChatVisible}
                onClose={() => setIsChatVisible(false)}
                socket={socket.current}
                rideId={currentRideId}
                userId={userId}
                initialMessages={initialChatMessages}
                onNewMessage={() => {
                    if (!isChatVisible) {
                        setUnreadCount(prev => prev + 1);
                    }
                }}
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
    },
    recenterButton: {
        backgroundColor: '#1D4ED8',
        padding: 12,
        borderRadius: 30,
        marginVertical: 5,
    },
    recenterButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    chatBadgeCount: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: 'white',
    },
    chatBadgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    referenceInput: {
        height: 44,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#374151',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    progressBarContainer: {
        width: '100%',
        height: 6,
        backgroundColor: '#E5E7EB',
        borderRadius: 3,
        overflow: 'hidden',
        marginVertical: 15,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#1D4ED8',
    },
    countdownText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E3A8A',
        marginBottom: 15,
        textAlign: 'center',
    },
    whatsappSupportBtn: {
        position: 'absolute',
        right: 20,
        backgroundColor: '#25D366',
        padding: 12,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 10,
    }
});
