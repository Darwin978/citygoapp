import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { loginApi } from '../../utils/services/userService';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from '../../utils/context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen({ navigation }: any) {
  const { login, aproveed } = useAuth()
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    if (!email || !password) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    try {
      console.log(email);
      console.log(password);


      const response = await loginApi(email, password);

      console.log("Login exitoso:", response);

      let authToken = response.access_token;
      let user = response.user;

      await AsyncStorage.setItem('authToken', authToken);
      await AsyncStorage.setItem('email', user.email);
      await AsyncStorage.setItem('role', user.role);
      login();
      aproveed(user.isApproved);

    } catch (error) {
      Alert.alert("Error", "Credenciales incorrectas, por favor intenta de nuevo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        {/* Header con el Logo */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo_fondo.png')}
            style={styles.logoSmall}
            resizeMode="contain"
          />
          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>Ingresa tus credenciales para continuar</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.inputLabel}>Correo Electrónico</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              placeholder="ejemplo@correo.com"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <Text style={styles.inputLabel}>Contraseña</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              placeholder="••••••••"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity disabled={loading} style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>{loading ? "Iniciando sesión..." : "Entrar"}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes una cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Regístrate</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  inner: { flex: 1, padding: 30, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logoSmall: { width: 300, height: 300, marginBottom: 0 },
  title: { fontSize: 26, fontWeight: '900', color: '#1E3A8A', marginBottom: 2 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
  form: { width: '100%' },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 15,
    marginBottom: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#1F2937' },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 30 },
  forgotText: { color: '#1D4ED8', fontWeight: '600', fontSize: 14 },
  loginBtn: {
    backgroundColor: '#1D4ED8',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  loginBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { color: '#6B7280', fontSize: 15 },
  registerLink: { color: '#1D4ED8', fontWeight: '800', fontSize: 15 },
});