import Constants from 'expo-constants';
import React, { useEffect } from 'react';
import { View, Image } from 'react-native';


const LoadingScreen = () => {
    return <View style={{ flex: 1, backgroundColor: 'white' }}>
        <Image
            source={require('../../assets/splash-icon.gif')}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
        />
    </View>;
};

export default LoadingScreen;