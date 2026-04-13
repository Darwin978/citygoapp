import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextProps {
  isLoggedIn: boolean;
  isApproved: boolean;
  setIsLoggedIn: (value: boolean) => void;
    logout: () => Promise<void>;
  login: () => Promise<void>;
    aproveed: (status: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  isLoggedIn: false,
  isApproved: false,
  setIsLoggedIn: () => {},
    logout: async () => { },
  login: async () => { },
    aproveed: async () => { }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    (async () => {
        const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
    })();
  }, []);

const logout = async () => {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('email');
  await AsyncStorage.removeItem('chat_id');
  setIsApproved(false);
    setIsLoggedIn(false);
  };
    
  const login = async () => setIsLoggedIn(true);
  const aproveed = async (status: boolean) => setIsApproved(status);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isApproved, setIsLoggedIn, logout, login, aproveed }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
