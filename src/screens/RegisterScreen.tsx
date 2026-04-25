import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { registerClientApi, registerDriverApi } from '../../utils/services/userService';
import { Roles } from '../../utils/services/rolesEnum';

interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color?: string;
}

export default function RegisterScreen({ navigation }: any) {
  const [role, setRole] = useState<'CLIENT' | 'DRIVER'>('CLIENT');
  const [cedulaImage, setCedulaImage] = useState<string | null>(null);

  // Estados de datos
  const [nombre, setNombre] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([{ plate: '', brand: '', model: '', color: '' }]);

  // Color constante para placeholders (Gris oscuro para fondo blanco)
  const placeholderColor = "#6B7280";

  // --- LÓGICA DE IMAGEN (OBLIGATORIA) ---
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para verificar tu identidad.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });
    if (!result.canceled) setCedulaImage(result.assets[0].uri);
  };

  // --- VALIDACIONES ---
  const validarCedulaEcu = (id: string) => {
    if (id.length !== 10) return false;
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let m = (i % 2 === 0) ? 2 : 1;
      let p = parseInt(id.charAt(i)) * m;
      suma += (p > 9) ? p - 9 : p;
    }
    const verif = (suma % 10 === 0) ? 0 : 10 - (suma % 10);
    return verif === parseInt(id.charAt(9));
  };


  const handleRegister = async () => {

    if (!nombre || !cedula || !email || !phone || !password || !confirmPassword) {
      return Alert.alert("Error", "Por favor completa todos los campos");
    }
    if (role === Roles.DRIVER) {
      for (let v of vehicles) {
        if (!v.plate || !v.brand || !v.model || !v.color) {
          return Alert.alert("Error", "Completa la información de todos los vehículos o elimina los que no uses.");
        }
      }
    }
    if (!cedulaImage) return Alert.alert("Falta Identificación", "Debes subir la foto de tu cédula para continuar.");
    if (!validarCedulaEcu(cedula)) return Alert.alert("Cédula Inválida", "El número de cédula no es correcto.");
    if (password.length < 8 || !/\d/.test(password)) {
      return Alert.alert("Seguridad", "La clave debe tener 8+ caracteres y al menos un número.");
    }
    if (password !== confirmPassword) return Alert.alert("Error", "Las claves no coinciden.");
    const formData = new FormData();

    // Datos normales
    formData.append('name', nombre);
    formData.append('identificacion', cedula);
    formData.append('email', email);
    formData.append('telefono', phone);
    formData.append('role', role);
    formData.append('password', password);
    formData.append('vehicles', JSON.stringify(vehicles));

    // El archivo (cedula_file debe coincidir con el nombre en el interceptor de NestJS)
    formData.append('cedula_file', {
      uri: Platform.OS === 'android' ? cedulaImage : cedulaImage.replace('file://', ''),
      type: 'image/jpeg', // O 'image/png' según la extensión
      name: 'upload.jpg',
    } as any);

    try {
      if (role === Roles.DRIVER) {
        const response = await registerDriverApi(formData);
      }
      if (role === Roles.USER) {
        const response = await registerClientApi(formData);
      }

      Alert.alert("Registro Enviado", "Hemos almacenado tus datos ahora ya puedes iniciar sesión. Ten en cuenta que tu cuenta está pendiente de aprobación, te notificaremos una vez que sea aprobada.");
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert("Error", "No se pudo subir la información");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      // Este offset es clave para que no tape el último input
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registro CityGo</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, role === Roles.USER && styles.activeTab]} onPress={() => setRole(Roles.USER)}>
            <Text style={[styles.tabText, role === Roles.USER && styles.activeTabText]}>Pasajero</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, role === Roles.DRIVER && styles.activeTab]} onPress={() => setRole(Roles.DRIVER)}>
            <Text style={[styles.tabText, role === Roles.DRIVER && styles.activeTabText]}>Conductor</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Información Personal</Text>
          <TextInput placeholder="Nombre Completo" placeholderTextColor={placeholderColor} style={styles.input} onChangeText={setNombre} />
          <TextInput
            placeholder="Cédula de Identidad"
            placeholderTextColor={placeholderColor}
            style={styles.input}
            keyboardType="numeric"
            maxLength={10}
            onChangeText={setCedula}
          />
          <TextInput placeholder="Correo Electrónico" placeholderTextColor={placeholderColor} style={styles.input} onChangeText={setEmail} />
          <TextInput placeholder="Número de Teléfono" placeholderTextColor={placeholderColor} style={styles.input} onChangeText={setPhone} keyboardType="numeric" />

          {/* SECCIÓN FOTO CÉDULA (OBLIGATORIA) */}
          <Text style={styles.label}>Foto de Cédula (Frontal) *</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
            {cedulaImage ? (
              <Image source={{ uri: cedulaImage }} style={styles.imagePreview} />
            ) : (
              <>
                <Ionicons name="id-card-outline" size={40} color="#1D4ED8" />
                <Text style={{ color: '#1D4ED8', fontWeight: '600' }}>Subir identificación</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Seguridad</Text>
          <TextInput placeholder="Clave (8+ caracteres, 1 número)" placeholderTextColor={placeholderColor} style={styles.input} secureTextEntry onChangeText={setPassword} />
          <TextInput placeholder="Confirmar Clave" placeholderTextColor={placeholderColor} style={styles.input} secureTextEntry onChangeText={setConfirmPassword} />

          {/* SECCIÓN VEHÍCULOS (CONDUCTOR) */}
          {role === 'DRIVER' && (
            <View style={{ marginTop: 10 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Vehículos ({vehicles.length}/3)</Text>
                {vehicles.length < 3 && (
                  <TouchableOpacity onPress={() => setVehicles([...vehicles, { plate: '', brand: '', model: '', color: '' }])}>
                    <Text style={styles.addText}>+ Añadir</Text>
                  </TouchableOpacity>
                )}
              </View>

              {vehicles.map((v, i) => (
                <View key={i} style={styles.vehicleCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.vehicleTitle}>Auto {i + 1}</Text>
                    {i > 0 && <TouchableOpacity onPress={() => setVehicles(vehicles.filter((_, idx) => idx !== i))}><Ionicons name="close-circle" size={20} color="red" /></TouchableOpacity>}
                  </View>
                  <TextInput
                    placeholder="Placa"
                    placeholderTextColor={placeholderColor}
                    style={styles.miniInput}
                    autoCapitalize="characters"
                    onChangeText={(text) => {
                      const newV = [...vehicles]; newV[i].plate = text; setVehicles(newV);
                    }}
                  />
                  <TextInput placeholder="Marca Ej: Toyota" autoCapitalize="characters" placeholderTextColor={placeholderColor} style={styles.miniInput} onChangeText={(text) => {
                    const newV = [...vehicles]; newV[i].brand = text; setVehicles(newV);
                  }} />
                  <TextInput placeholder="Modelo Ej: Corolla 2024" autoCapitalize="characters" placeholderTextColor={placeholderColor} style={styles.miniInput} onChangeText={(text) => {
                    const newV = [...vehicles]; newV[i].model = text; setVehicles(newV);
                  }} />
                  <TextInput placeholder="Color Ej: Rojo" autoCapitalize="characters" placeholderTextColor={placeholderColor} style={styles.miniInput} onChangeText={(text) => {
                    const newV = [...vehicles]; newV[i].color = text; setVehicles(newV);
                  }} />
                </View>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister}>
          <Text style={styles.btnText}>Enviar para Aprobación</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#1D4ED8', padding: 25, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#E5E7EB', margin: 20, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: 'white' },
  tabText: { fontWeight: 'bold', color: '#9CA3AF' },
  activeTabText: { color: '#1D4ED8' },
  form: { paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginVertical: 8 },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 12, fontSize: 16, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
  uploadBox: { height: 180, backgroundColor: '#E0E7FF', borderStyle: 'dashed', borderWidth: 2, borderColor: '#1D4ED8', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addText: { color: '#1D4ED8', fontWeight: 'bold' },
  vehicleCard: { backgroundColor: 'white', padding: 15, borderRadius: 15, marginBottom: 10, elevation: 2 },
  vehicleTitle: { fontWeight: 'bold', marginBottom: 10, color: '#1E3A8A' },
  miniInput: { backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB', color: '#1F2937' },
  btnPrimary: { backgroundColor: '#1D4ED8', margin: 20, padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});