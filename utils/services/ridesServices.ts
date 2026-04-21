import axios from "axios";
import { endPoint } from "./apiConfig";

interface requestRideDto {
    originAddress: string,
    destinationAddress: string,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    finalPrice: number,
}
export async function requestRide(data: requestRideDto) {
    try {
        const response = await fetch(endPoint.requestRide, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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