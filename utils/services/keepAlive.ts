import { NativeModules, Platform } from 'react-native';

/**
 * Controla el Foreground Service nativo de Android que mantiene vivo
 * el proceso JS cuando el conductor está disponible para recibir carreras.
 *
 * En iOS no hace nada (el modelo de background de iOS es diferente y
 * se maneja a través de APNs + silent push).
 */
const { KeepAlive } = NativeModules;

export function startKeepAlive(): void {
    if (Platform.OS === 'android' && KeepAlive) {
        KeepAlive.start();
    }
}

export function stopKeepAlive(): void {
    if (Platform.OS === 'android' && KeepAlive) {
        KeepAlive.stop();
    }
}
