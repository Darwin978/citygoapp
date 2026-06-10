
export const BACKEND_URL = process.env.BACKEND_URL || 'https://api.citygoec.com';
//export const BACKEND_URL = 'http://192.168.1.107:3000';
export const endPoint = {
    login: `${BACKEND_URL}/auth/login`,
    registerClient: `${BACKEND_URL}/auth/register/client`,
    registerDriver: `${BACKEND_URL}/auth/register/driver`,
    getUserInfo: `${BACKEND_URL}/users/me`,
    getUserStats: `${BACKEND_URL}/users/me/stats`,
    getUserInfoApproved: `${BACKEND_URL}/auth/isAproved`,
    requestRide: `${BACKEND_URL}/ride`,
    activeRide: `${BACKEND_URL}/ride/me/active`,
    getPrice: `${BACKEND_URL}/ride/price`,
    cancelSolicitud: `${BACKEND_URL}/ride/cancel-solicitud`,
    driverCancelRide: `${BACKEND_URL}/ride/driver-cancel`,
    getRideById: `${BACKEND_URL}/ride`,
    addVehicle: `${BACKEND_URL}/vehicles`,
    getUserVehicles: `${BACKEND_URL}/vehicles/driver`,
    setActiveVehicle: `${BACKEND_URL}/driver/activeVehicle`,
    deleteVehicle: `${BACKEND_URL}/vehicles`,
    saveToken: `${BACKEND_URL}/users/save-token`,
    updateStatusDriver: `${BACKEND_URL}/driver/update-status`,
    sendRating: `${BACKEND_URL}/rating`,
    updateLocation: `${BACKEND_URL}/driver/location`,
}
