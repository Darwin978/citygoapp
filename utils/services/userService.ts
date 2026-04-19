import { endPoint } from "./apiConfig";
import axios from 'axios';

export async function loginApi(email: string, password: string) {
    try {
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
        const response = await fetch(endPoint.registerDriver, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error('Registration failed');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
}