import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }: any) {
  const [role, setRole] = useState<'CLIENT' | 'DRIVER'>('CLIENT');
  const [cedulaImage, setCedulaImage] = useState<string | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para la cédula.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setCedulaImage(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Azul */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crear Cuenta</Text>
      </View>

      {/* Selector de Rol (Tipo Tabs) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, role === 'CLIENT' && styles.activeTab]} 
          onPress={() => setRole('CLIENT')}
        >
          <Ionicons name="person" size={20} color={role === 'CLIENT' ? '#1D4ED8' : '#9CA3AF'} />
          <Text style={[styles.tabText, role === 'CLIENT' && styles.activeTabText]}>Pasajero</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, role === 'DRIVER' && styles.activeTab]} 
          onPress={() => setRole('DRIVER')}
        >
          <Ionicons name="car" size={20} color={role === 'DRIVER' ? '#1D4ED8' : '#9CA3AF'} />
          <Text style={[styles.tabText, role === 'DRIVER' && styles.activeTabText]}>Conductor</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Datos Personales</Text>
        <TextInput placeholder="Nombre y Apellido" style={styles.input} />
        <TextInput placeholder="Cédula de Identidad" style={styles.input} keyboardType="numeric" />
        <TextInput placeholder="WhatsApp (Ej: 098...)" style={styles.input} keyboardType="phone-pad" />

        {/* Sección de Cédula (Para ambos) */}
        <Text style={[styles.label, { marginTop: 10 }]}>Verificación de Identidad *</Text>
        <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
          {cedulaImage ? (
            <Image source={{ uri: cedulaImage }} style={styles.imagePreview} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={32} color="#1D4ED8" />
              <Text style={styles.uploadText}>Subir foto frontal de cédula</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Campos Extra para Conductor */}
        {role === 'DRIVER' && (
          <View style={styles.driverSection}>
            <Text style={styles.label}>Información del Vehículo</Text>
            <TextInput placeholder="Placa (Ej: ABC-1234)" style={styles.input} autoCapitalize="characters" />
            <TextInput placeholder="Marca y Modelo del auto" style={styles.input} />
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={styles.btnPrimary}
        onPress={() => navigation.navigate('Pending')} // Pantalla "En Revisión"
      >
        <Text style={styles.btnText}>Enviar para Aprobación</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#1D4ED8', padding: 25, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', margin: 20, borderRadius: 12, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: 'white', elevation: 2 },
  tabText: { marginLeft: 8, fontWeight: 'bold', color: '#9CA3AF' },
  activeTabText: { color: '#1D4ED8' },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8, marginLeft: 5 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  uploadBox: { height: 160, backgroundColor: '#E0E7FF', borderStyle: 'dashed', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  uploadText: { color: '#1D4ED8', marginTop: 8, fontWeight: '500' },
  imagePreview: { width: '100%', height: '100%' },
  driverSection: { marginTop: 10 },
  btnPrimary: { backgroundColor: '#1D4ED8', margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});