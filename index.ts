import { registerRootComponent } from 'expo';
import * as TaskManager from 'expo-task-manager';
import { BACKEND_URL } from './utils/services/apiConfig';
import App from './App';

// ─────────────────────────────────────────────────────────────────────────────
// TAREA DE UBICACIÓN EN SEGUNDO PLANO
//
// REGLA CRÍTICA de Expo: TaskManager.defineTask DEBE ejecutarse antes de
// registerRootComponent y en el scope global del módulo de entrada (index.ts).
// Si se define dentro de un componente React o en otro archivo el SO no podrá
// invocar la tarea cuando la app está suspendida o incluso cerrada.
// ─────────────────────────────────────────────────────────────────────────────
TaskManager.defineTask('LOCATION_TASK', async ({ data, error }: any) => {
  if (error) {
    console.error('[BG-LOCATION] Error en la tarea:', error.message);
    return;
  }

  if (!data?.locations?.length) return;

  const { latitude, longitude } = data.locations[0].coords;

  try {
    // Importamos AsyncStorage dinámicamente: en el contexto headless (app cerrada)
    // los módulos se cargan de forma perezosa y es más seguro importarlos así.
    const AsyncStorage = (
      await import('@react-native-async-storage/async-storage')
    ).default;

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return; // No hay sesión activa, nada que actualizar

    // Usamos fetch (disponible en el contexto headless) para enviar la ubicación
    // al backend vía REST. El WebSocket no está disponible en segundo plano.
    await fetch(`${BACKEND_URL}/driver/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ lat: latitude, lng: longitude }),
    });
  } catch (err) {
    // Silenciamos errores de red en background — no queremos crashear el proceso
    console.warn('[BG-LOCATION] Error enviando ubicación:', err);
  }
});

registerRootComponent(App);
