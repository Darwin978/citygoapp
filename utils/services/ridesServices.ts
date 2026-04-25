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

export async function getPriceApi(originLat: number, originLng: number, destLat: number, destLng: number) {
    try {
        const data = {
            originLat: originLat, originLng: originLng, destLat: destLat, destLng: destLng, categoryId: 1
        }
        console.log("data", data)
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