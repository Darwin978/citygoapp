import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Linking } from 'react-native';
import colors from '../../../utils/style/colors';
import { usePermissions } from '../../../utils/context/PermissionContext';

export default function TerminosScreen({ navigation }:any) {

  const { acceptTerms } = usePermissions();

  const handleAccept = async () => {
    await acceptTerms();
    navigation.replace("Login");
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        <Text style={styles.title}>Términos y Condiciones</Text>

        <Text style={styles.message}>
          Para utilizar la aplicación debes aceptar los 
          <Text
            style={styles.link}
            onPress={() => Linking.openURL("citygoec.com")}
          >
            {' '}Términos y Condiciones.
          </Text>
        </Text>

        <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={handleAccept}>
          <Text style={styles.buttonText}>Aceptar Términos y Condiciones</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: "center",
    color: "#000",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
    lineHeight: 22,
  },
  link: {
    color: colors.premium.primary,
    textDecorationLine: "underline",
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: colors.premium.primary,
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
