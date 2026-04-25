import AsyncStorage from "@react-native-async-storage/async-storage";
import { endPoint } from "./apiConfig";

export async function addVehicleApi(vehicle: any) {

    try {
        const token = await AsyncStorage.getItem('authToken');
        console.log("data", vehicle)
        if (!token) {
            throw new Error('No token found');
        }
        const response = await fetch(endPoint.addVehicle, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehicle)
        });

        console.log("response", response)

        if (!response.ok) {
            throw new Error('Error al agregar vehiculo');
        }

        const data = await response.json();
        return data;

    }
    catch (error) {
        console.error('Error during vehicle add:', error);
        throw error;
    }
}

export async function getUserVehicles() {
    try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
            throw new Error('No token found');
        }
        const response = await fetch(endPoint.getUserVehicles, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error during vehicle get:', error);
        throw error;
    }
}

export async function setActiveVehicle(vehicleId: string) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
            throw new Error('No token found');
        }
        const response = await fetch(endPoint.setActiveVehicle, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ deviceId: vehicleId })
        });

        if (!response.ok) {
            throw new Error('Error al activar vehiculo');
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error during vehicle set active:', error);
        throw error;
    }
}

export async function deleteVehicleApi(vehicleId: string) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        if (!token) {
            throw new Error('No token found');
        }
        const response = await fetch(endPoint.deleteVehicle + `/${vehicleId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al eliminar vehiculo');
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error('Error during vehicle delete:', error);
        throw error;
    }
}   