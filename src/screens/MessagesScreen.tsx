import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../utils/context/AuthContext';
import io from 'socket.io-client';
import { BACKEND_URL } from '../../utils/services/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MessagesScreen({ route }: { route: any }) {
  const { rideId } = route?.params || { rideId: 'test_ride' };

  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const socket = useRef<any>(null);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => setUserId(id));
  }, []);

  useEffect(() => {
    if (!userId) return;

    socket.current = io(BACKEND_URL, {
      query: { userId: userId }
    });

    // 1. Unirse a la sala de la carrera
    socket.current.emit('joinRide', rideId);

    // 2. Escuchar mensajes nuevos desde el servidor
    socket.current.on('new_message', (payload: any) => {
      const isMe = payload.senderId === userId;

      const incomingMsg = {
        id: Math.random().toString(),
        text: payload.text,
        sender: isMe ? 'me' : 'other',
        time: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, incomingMsg]);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // Limpieza al salir de la pantalla
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [rideId, userId]);

  const sendMessage = () => {
    if (inputText.trim() === '') return;

    const messageData = {
      rideId: rideId,
      senderId: userId,
      text: inputText,
    };

    // 3. Enviar al backend vía Socket
    socket.current?.emit('send_message', messageData);

    setInputText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
      style={styles.container}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, marginTop: 20 }}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.sender === 'me' ? styles.myBubble : styles.otherBubble
          ]}>
            <Text style={[
              styles.messageText,
              item.sender === 'me' ? styles.myText : styles.otherText
            ]}>
              {item.text}
            </Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        )}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={inputText}
          onChangeText={setInputText}
          placeholderTextColor={'gray'}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  chatList: { padding: 20, paddingBottom: 40 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 16 },
  myText: { color: 'white' },
  otherText: { color: '#374151' },
  timeText: { fontSize: 10, color: '#9CA3AF', marginTop: 5, alignSelf: 'flex-end' },
  inputArea: { flexDirection: 'row', padding: 15, backgroundColor: 'white', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 25, paddingHorizontal: 20, height: 45 },
  sendBtn: { backgroundColor: '#1D4ED8', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});