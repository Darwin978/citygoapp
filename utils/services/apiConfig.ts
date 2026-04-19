
export const BACKEND_URL = process.env.BACKEND_URL || 'http://192.168.1.150:3000';

export const endPoint = {
    login: `${BACKEND_URL}/auth/login`,
    registerClient: `${BACKEND_URL}/auth/register/client`,
    registerDriver: `${BACKEND_URL}/auth/register/driver`,
    getUserInfo: `${BACKEND_URL}/auth/me`,
    getUserInfoApproved: `${BACKEND_URL}/auth/isAproved`


}