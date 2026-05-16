export type BackendRideStatus =
    | 'REQUESTED'
    | 'ACCEPTED'
    | 'DRIVER_ARRIVED'
    | 'TO_DESTINO'
    | 'IN_PROGRESS'
    | 'TO_RATING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'IDLE';

export const activeRideStatuses: BackendRideStatus[] = [
    'REQUESTED',
    'ACCEPTED',
    'DRIVER_ARRIVED',
    'TO_DESTINO',
    'IN_PROGRESS',
    'TO_RATING',
];

export function isActiveBackendRideStatus(status?: string | null) {
    return activeRideStatuses.includes(status as BackendRideStatus);
}

export function isTripInProgress(status?: string | null) {
    return status === 'IN_PROGRESS' || status === 'TO_DESTINO';
}

export function mapBackendStatusToPassengerScreen(status?: string | null) {
    if (status === 'REQUESTED') return 'SEARCHING';
    if (status === 'TO_RATING') return 'TO_RATING';
    if (isTripInProgress(status)) return 'TO_DESTINO';
    if (status === 'ACCEPTED' || status === 'DRIVER_ARRIVED') return 'ON_RIDE';
    return 'PICKUP';
}

export function mapBackendStatusToDriverScreen(status?: string | null) {
    if (status === 'REQUESTED') return 'SEARCHING';
    if (status === 'ACCEPTED' || status === 'DRIVER_ARRIVED' || isTripInProgress(status)) return 'ON_RIDE';
    return 'PICKUP';
}

export function coordsFromRideData(rideData: any) {
    return {
        pickup: { latitude: rideData.pickupCoords.lat, longitude: rideData.pickupCoords.lng },
        destination: { latitude: rideData.destCoords.lat, longitude: rideData.destCoords.lng },
    };
}
