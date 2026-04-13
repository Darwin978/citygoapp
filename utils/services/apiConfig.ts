const BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.1.150:3000';

export const endPoint = {
    login: `${BACKEND_URL}/auth/login`,
    register: `${BACKEND_URL}/register`,
    getUserInfo: `${BACKEND_URL}/auth/me`,


}