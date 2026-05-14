import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onRecenter: () => void;
    isManualZoom: boolean;
}

const MapZoomControls = ({ onZoomIn, onZoomOut, onRecenter, isManualZoom }: MapZoomControlsProps) => {
    return (
        <View style={styles.container}>
            {/* Botón de Recentrar (Auto-Zoom) - Solo aparece si el zoom es manual */}
            {isManualZoom && (
                <TouchableOpacity
                    style={[styles.button, styles.recenterButton]}
                    onPress={onRecenter}
                    activeOpacity={0.7}
                >
                    <Ionicons name="locate" size={24} color="white" />
                </TouchableOpacity>
            )}

            <View style={styles.zoomGroup}>
                <TouchableOpacity style={styles.button} onPress={onZoomIn} activeOpacity={0.7}>
                    <Ionicons name="add" size={30} color="#333" />
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity style={styles.button} onPress={onZoomOut} activeOpacity={0.7}>
                    <Ionicons name="remove" size={30} color="#333" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 15,
        bottom: 280, // Ajusta esto según dónde esté tu tarjeta de información
        alignItems: 'center',
    },
    zoomGroup: {
        backgroundColor: 'white',
        borderRadius: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    button: {
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recenterButton: {
        backgroundColor: '#1D4ED8', // Azul CityGo
        borderRadius: 25,
        marginBottom: 10,
        elevation: 5,
    },
    separator: {
        height: 1,
        backgroundColor: '#E5E7EB',
        width: '80%',
        alignSelf: 'center',
    },
});

export default MapZoomControls;