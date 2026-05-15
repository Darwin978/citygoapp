import AsyncStorage from "@react-native-async-storage/async-storage";
import { endPoint } from "./apiConfig";
import axios from 'axios';

export async function loginApi(email: string, password: string) {
    try {
        console.log(endPoint.login);
        console.log("Ingresa login");
        const response = await fetch(endPoint.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
}

export async function updateStatusDriverApi(status: boolean) {
    try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.updateStatusDriver, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status }),
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error updating status:', error);
        throw error;
    }
}

export async function getUserInfoApi(token: string) {
    try {
        const response = await fetch(endPoint.getUserInfo, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during user info fetch:', error);
        throw error;
    }
}

export async function getUserInfoApproved(token: string) {
    try {
        const response = await fetch(endPoint.getUserInfoApproved, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during user info fetch:', error);
        throw error;
    }
}

export async function registerClientApi(formData: any) {
    try {
        console.log("Ingresa registro cliente");

        const response = await axios.post(endPoint.registerClient, formData, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data'
            },
        });

        if (!response.status || response.status < 200 || response.status >= 300) {
            throw new Error('Registration failed');
        }

        const data = await response.data;
        return data;
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
}

export async function registerDriverApi(formData: any) {
    try {
        console.log("Ingresa registro conuctor");

        const response = await axios.post(endPoint.registerDriver, formData, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'multipart/form-data'
            },
        });

        if (!response.status || response.status < 200 || response.status >= 300) {
            throw new Error('Registration failed');
        }

        const data = await response.data;
        return data;
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
}

export async function saveTokenInBackend(token: string) {
    try {
        const tokenUser = await AsyncStorage.getItem('authToken');
        const response = await fetch(endPoint.saveToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenUser}`
            },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            throw new Error('Failed to save token');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error saving token:', error);
        throw error;
    }
}

export async function sendRatingApi(ratingData: any) {
    try {
        console.log("Ingresa envio de rating", ratingData);
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${endPoint.sendRating}/${ratingData.rideId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                driverId: ratingData.driverId,
                score: ratingData.score,
                comment: ratingData.comment
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to send rating');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error sending rating:', error);
        throw error;
    }
}