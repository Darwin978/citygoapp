# CityGo App (Aplicación Móvil)

## Arquitectura
Esta aplicación móvil está desarrollada utilizando **React Native** y el ecosistema **Expo**, lo que permite construir para iOS y Android desde un único código fuente. Emplea un enfoque moderno basado en componentes funcionales y hooks de React.

La navegación entre pantallas está gobernada por **React Navigation** (implementando tanto flujos de Stack para inicio de sesión, como Bottom Tabs para la vista principal). La comunicación de datos ocurre en dos frentes: consultas de API REST mediante `axios` para acciones asíncronas estándar, y una conexión bidireccional en tiempo real vía `socket.io-client` para la geolocalización dinámica durante un viaje.

## Estructura de Directorios y Archivos Principales

* `App.tsx` / `index.ts`: Archivos principales y punto de entrada de la aplicación. Aquí se inicializa Expo, se registran los servicios en segundo plano y se cargan los proveedores de estado o contextos (Providers) que envuelven la aplicación.
* `src/screens/`: Directorio que contiene las vistas de pantalla completa (ej. Pantalla de Login, Mapa Principal, Historial de Viajes, Perfil del Usuario).
* `src/components/`: Colección de componentes de interfaz de usuario reutilizables (Botones, Inputs, Tarjetas de viaje, Marcadores personalizados para el mapa, Modales).
* `src/navigation/`: Archivos de configuración para el enrutamiento. Define el mapa de pantallas y cómo el usuario transita entre ellas.
* `src/store/`: Manejo del estado global de la aplicación (puede contener la lógica de un estado de Redux, Zustand o Context API para mantener en memoria los datos del usuario logueado o del viaje en curso).
* `firebase/`: Configuración y claves necesarias para conectar la aplicación con los servicios de Firebase.
* `utils/`: Directorio para funciones de apoyo, formateadores de texto/moneda y constantes compartidas.
* `app.json` / `eas.json`: Configuración específica de Expo y de los servicios de construcción en la nube (Expo Application Services), metadatos de la app, iconos, y permisos requeridos para iOS/Android.

## Funciones Principales
- **Geolocalización y Visualización de Mapas:** Integración intensiva con `react-native-maps`, uso de `expo-location` para rastrear la ubicación del dispositivo, y `react-native-google-places-autocomplete` junto a `react-native-maps-directions` para buscar direcciones y trazar rutas.
- **Rastreo en Tiempo Real:** Establecimiento de conexiones web sockets persistentes para enviar y recibir actualizaciones de ubicación de conductores al instante.
- **Notificaciones Push y en Segundo Plano:** Uso de `@react-native-firebase/messaging` y `expo-notifications` para recibir alertas de cambios en el estado del viaje incluso cuando la app no está en primer plano, aprovechando también `expo-task-manager` para ejecutar tareas en el fondo.
- **Persistencia de Sesión:** Manejo seguro del token de sesión guardándolo en `@react-native-async-storage/async-storage` para evitar que el usuario tenga que iniciar sesión repetidamente.
