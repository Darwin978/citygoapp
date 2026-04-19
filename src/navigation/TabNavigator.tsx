import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

// Importación de tus pantallas
import HomeScreen from '../screens/HomeScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Estilo de la cabecera superior (Header)
        headerStyle: { 
          backgroundColor: '#1D4ED8',
          elevation: 0, // Quita sombra en Android
          shadowOpacity: 0, // Quita sombra en iOS
        },
        headerTitleAlign: 'center',
        headerTitleStyle: { 
          color: 'white', 
          fontWeight: '900', 
          fontSize: 20,
          letterSpacing: 0.5 
        },
        headerTitle: "CityGo",
        
        // Estilo de la barra inferior (Tab Bar)
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 5,
        },
        tabBarStyle: { 
          height: 60 + insets.bottom, // Aumenta la altura para incluir el área segura
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 20, // Asegura espacio para el área segura
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          backgroundColor: 'white',
        },
        
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Mapa') {
            iconName = focused ? 'map' : 'map';
          } else if (route.name === 'Mensajes') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return (
            <View style={focused ? styles.activeTabIcon : null}>
              <Ionicons 
                name={iconName} 
                size={24} // Usamos el size que viene por defecto
                color={focused ? '#1D4ED8' : '#9CA3AF'} // Este color es #1D4ED8 cuando focused es true
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen 
        name="Mapa" 
        component={HomeScreen} 
        options={{ title: 'Explorar' }} 
      />
      <Tab.Screen 
        name="Mensajes" 
        component={MessagesScreen} 
        options={{ title: 'Mensajes', tabBarBadge: 2 }} // Badge para simular notificaciones
      />
      <Tab.Screen 
        name="Perfil" 
        component={ProfileScreen} 
        options={{ title: 'Mi Perfil' }}
      />
      </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeTabIcon: {
    backgroundColor: 'transparent', // Azul claro de fondo
  }
});