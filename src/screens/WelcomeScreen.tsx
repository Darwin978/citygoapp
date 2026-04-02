import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Conecta con tu viaje</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.roleButton}>
            <Ionicons name="person" size={24} color="white" />
            <Text style={styles.buttonText}>Soy Pasajero</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.roleButton, { marginTop: 15 }]}>
            <Ionicons name="car" size={24} color="white" />
            <Text style={styles.buttonText}>Soy Conductor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Iniciar Sesión</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.footerLink, { marginTop: 10 }]}>Registrarse</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1E40AF', marginBottom: 5 },
  subtitle: { fontSize: 18, color: '#6B7280', marginBottom: 40 },
  buttonContainer: { width: '100%' },
  roleButton: {
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  footer: { marginTop: 50, alignItems: 'center' },
  footerLink: { color: '#1D4ED8', fontSize: 16, fontWeight: '500' },
});