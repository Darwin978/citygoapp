// RatingModal.tsx
import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RatingModal({ visible, onSend, driverName }: any) {
    const [score, setScore] = useState(5);
    const [comment, setComment] = useState('');

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>¿Cómo estuvo tu último viaje?</Text>

                    <View style={styles.starsContainer}>
                        <Text style={styles.reviewText}>
                            {["Terrible", "Malo", "Aceptable", "Bueno", "Excelente"][score - 1]}
                        </Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setScore(star)}>
                                    <Ionicons
                                        name={star <= score ? "star" : "star-outline"}
                                        size={45}
                                        color={star <= score ? "#F59E0B" : "#D1D5DB"}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholderTextColor={"#acaaaaff"}
                        placeholder="Déjanos un comentario (opcional)"
                        multiline
                        onChangeText={setComment}
                    />

                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => onSend(score, comment)}
                    >
                        <Text style={styles.buttonText}>Enviar Calificación</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)', // Fondo oscuro semitransparente para enfocar la atención
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E3A8A', // Azul oscuro de CityGo
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 14,
        color: '#1E3A8A',
        marginBottom: 10,
        textAlign: 'center',
    },
    starsContainer: {
        alignItems: 'center',
        marginVertical: 15,
    },
    reviewText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E3A8A',
        marginBottom: 10,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    input: {
        width: '100%',
        backgroundColor: '#F3F4F6',
        borderRadius: 15,
        padding: 15,
        marginTop: 20,
        height: 100,
        textAlignVertical: 'top', // Para que el texto empiece arriba en Android
        color: '#374151',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#1D4ED8', // Azul principal de la marca
        width: '100%',
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    skipButton: {
        marginTop: 15,
        padding: 10,
    },
    skipText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    }
});