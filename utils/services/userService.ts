import { endPoint } from "./apiConfig";

export async function loginApi(username: string, password: string) {
    try {
        const response = await fetch(endPoint.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
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