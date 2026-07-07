import axios from "axios";
import { endPoint } from "./apiConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface requestRideDto {
    originAddress: string,
    destinationAddress: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    finalPrice: number,
    paymentMethod: 'CASH' | 'CARD',
    reference?: string;
}
export async function requestRideApi(data: requestRideDto) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.requestRide, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('RIDE REQUEST ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
}

export async function getActiveRideApi() {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.activeRide, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('ACTIVE RIDE FETCH ERROR');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching active ride:', error);
        throw error;
    }
}

export async function getPriceApi(originLat: number, originLng: number, destLat: number, destLng: number) {
    try {
        const data = {
            originLat: originLat, originLng: originLng, destLat: destLat, destLng: destLng, categoryId: 1
        }
        const response = await fetch(endPoint.getPrice, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error('PRICE FETCH ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error during price fetch:', error);
        throw error;
    }
}

/** Obtiene el estado completo de una carrera por ID.
 *  Funciona aunque el conductor aún no esté asignado (status REQUESTED). */
export async function getRideByIdApi(rideId: string) {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`${endPoint.getRideById}/${rideId}/status`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) throw new Error('RIDE FETCH ERROR');
    return response.json();
}

export async function driverCancelRideApi(rideId: string) {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(endPoint.driverCancelRide + `/${rideId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) throw new Error('DRIVER CANCEL ERROR');
    return response.json();
}

export async function cancelSolicitudApi(id: string) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.cancelSolicitud + `/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('CANCEL SOLICITUD ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error during cancel solicitud:', error);
        throw error;
    }
}

export async function preparePaymentApi(rideId: string) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${endPoint.preparePayment}/${rideId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('PREPARE PAYMENT ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error preparing payment:', error);
        throw error;
    }
}

export async function getPaymentStatusApi(paymentId: string) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${endPoint.getPaymentStatus}/${paymentId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('GET PAYMENT STATUS ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error fetching payment status:', error);
        throw error;
    }
}

export async function getAvailableRidesApi() {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.availableRides, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('GET AVAILABLE RIDES ERROR');
        }

        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error('Error fetching available rides:', error);
        throw error;
    }
}
