
//export const BACKEND_URL = process.env.BACKEND_URL || 'https://api.citygoec.com';
export const BACKEND_URL = 'http://192.168.1.150:3000';
export const endPoint = {
    login: `${BACKEND_URL}/auth/login`,
    registerClient: `${BACKEND_URL}/auth/register/client`,
    registerDriver: `${BACKEND_URL}/auth/register/driver`,
    getUserInfo: `${BACKEND_URL}/users/me`,
    getUserInfoApproved: `${BACKEND_URL}/auth/isAproved`,
    requestRide: `${BACKEND_URL}/ride`,
    getPrice: `${BACKEND_URL}/ride/price`,
    cancelSolicitud: `${BACKEND_URL}/ride/cancel-solicitud`,
    addVehicle: `${BACKEND_URL}/vehicles`,
    getUserVehicles: `${BACKEND_URL}/vehicles/driver`,
    setActiveVehicle: `${BACKEND_URL}/driver/activeVehicle`,
    deleteVehicle: `${BACKEND_URL}/vehicles`,

}