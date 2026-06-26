import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../services/apiConfig';

interface AuthContextProps {
  isLoggedIn: boolean;
  isApproved: boolean;
  isAuthReady: boolean;
  setIsLoggedIn: (value: boolean) => void;
  logout: () => Promise<void>;
  login: () => Promise<void>;
  aproveed: (status: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  isApproved: false,
  isAuthReady: false,
  setIsLoggedIn: () => {},
  logout: async () => { },
  login: async () => { },
  aproveed: async () => { }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          // Cargar aprobación guardada en caché para mostrar la pantalla correspondiente de inmediato
          const cachedApproved = await AsyncStorage.getItem('isApproved') === 'true';
          setIsApproved(cachedApproved);
          setIsLoggedIn(true);

          // Verificar estado más reciente con el backend
          try {
            const response = await fetch(`${BACKEND_URL}/auth/isAproved`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              const approved = !!data.isApproved;
              setIsApproved(approved);
              await AsyncStorage.setItem('isApproved', String(approved));
            }
          } catch (e) {
            console.log('Error verifying approval status on startup:', e);
          }
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('Error restoring auth state:', error);
      } finally {
        setIsAuthReady(true);
      }
    })();
  }, []);

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const role = await AsyncStorage.getItem('role');

      if (token) {
        // 1. Si es conductor, ponerlo offline en el backend
        if (role === 'DRIVER') {
          try {
            await fetch(`${BACKEND_URL}/driver/update-status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ status: false }),
            });
          } catch (e) {
            console.log('Error setting driver offline during logout:', e);
          }
        }

        // 2. Eliminar el FCM token del usuario en el backend
        try {
          await fetch(`${BACKEND_URL}/users/save-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token: null }),
          });
        } catch (e) {
          console.log('Error clearing push token during logout:', e);
        }
      }
    } catch (error) {
      console.error('Error during logout api calls:', error);
    } finally {
      // Siempre limpiar storage local y estados
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('email');
      await AsyncStorage.removeItem('userId');
      await AsyncStorage.removeItem('role');
      await AsyncStorage.removeItem('activeRideId');
      await AsyncStorage.removeItem('isApproved');
      setIsApproved(false);
      setIsLoggedIn(false);
    }
  };
    
  const login = async () => setIsLoggedIn(true);
  const aproveed = async (status: boolean) => setIsApproved(status);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isApproved, isAuthReady, setIsLoggedIn, logout, login, aproveed }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
