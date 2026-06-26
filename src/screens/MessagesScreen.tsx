import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import { BACKEND_URL } from '../../utils/services/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveRideApi } from '../../utils/services/ridesServices';
import { isChatEnabledRideStatus } from '../../utils/services/rideFlow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChatMessage = {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
};

function mapMessage(payload: any, userId: string): ChatMessage {
  return {
    id: payload.id || `${payload.senderId}-${payload.timestamp}-${Math.random()}`,
    text: payload.text,
    sender: payload.senderId === userId ? 'me' : 'other',
    time: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState('CityGo');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const socket = useRef<any>(null);

  const chatEnabled = useMemo(() => isChatEnabledRideStatus(rideStatus), [rideStatus]);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((id) => setUserId(id));
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadActiveChat = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const activeRide = await getActiveRideApi();
        if (!mounted) return;

        if (!activeRide?.rideData || !isChatEnabledRideStatus(activeRide.status)) {
          setRideId(null);
          setRideStatus(activeRide?.status || null);
          setMessages([]);
          return;
        }

        const activeRideId = activeRide.rideData.tripId;
        setRideId(activeRideId);
        setRideStatus(activeRide.status);
        setParticipantName(activeRide.clientId === userId ? activeRide.rideData.driver?.name || 'Conductor' : activeRide.rideData.clientName || 'Pasajero');
        setMessages((activeRide.rideData.messages || []).map((message: any) => mapMessage(message, userId)));
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 200);
        await AsyncStorage.setItem('activeRideId', activeRideId);
      } catch (error) {
        console.log('No se pudo cargar el chat activo', error);
        setRideId(null);
        setMessages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadActiveChat();
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !rideId || !chatEnabled) return;

    let mounted = true;

    const connect = async () => {
      const token = await AsyncStorage.getItem('authToken');
      if (!mounted) return;

      socket.current = io(BACKEND_URL, {
        query: { userId },
        auth: { token },
      });

      socket.current.on('connect', () => {
        socket.current.emit('joinRide', rideId);
      });

      socket.current.on('new_message', (payload: any) => {
        if (payload.rideId !== rideId) return;
        setMessages((prev) => [...prev, mapMessage(payload, userId)]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      });

      socket.current.on('ride_finished', () => setRideStatus('TO_RATING'));
      socket.current.on('trip_completed_success', () => setRideStatus('TO_RATING'));
    };

    connect();

    return () => {
      mounted = false;
      socket.current?.disconnect();
      socket.current = null;
    };
  }, [rideId, userId, chatEnabled]);

  const sendMessage = () => {
    if (inputText.trim() === '' || !socket.current || !rideId || !userId || !chatEnabled) return;

    socket.current.emit('send_message', {
      rideId,
      senderId: userId,
      text: inputText.trim(),
    });
    setInputText('');
  };

  if (loading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color="#1D4ED8" />
        <Text style={styles.centerText}>Buscando chat activo...</Text>
      </View>
    );
  }

  if (!rideId || !chatEnabled) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="chatbubbles-outline" size={54} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>Sin chat activo</Text>
        <Text style={styles.centerText}>El chat se habilita cuando una carrera es aceptada y se cierra al finalizar.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>{participantName}</Text>
        <Text style={styles.headerSubtitle}>Chat de carrera activa</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
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
        contentContainerStyle={[styles.chatList, messages.length === 0 && styles.emptyChatList]}
        ListEmptyComponent={<Text style={styles.centerText}>Todavía no hay mensajes.</Text>}
      />

      <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={inputText}
          onChangeText={setInputText}
          placeholderTextColor="#6B7280"
          multiline
          onFocus={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }}
        />
        <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!inputText.trim()}>
          <Ionicons name="send" size={22} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: 'white', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E3A8A' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  list: { flex: 1 },
  chatList: { padding: 20, paddingBottom: 28 },
  emptyChatList: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 15, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 16 },
  myText: { color: 'white' },
  otherText: { color: '#374151' },
  timeText: { fontSize: 10, color: '#9CA3AF', marginTop: 5, alignSelf: 'flex-end' },
  inputArea: { flexDirection: 'row', padding: 12, backgroundColor: 'white', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, maxHeight: 110, color: '#111827' },
  sendBtn: { backgroundColor: '#1D4ED8', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendBtnDisabled: { backgroundColor: '#93A8D8' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F3F4F6' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E3A8A', marginTop: 12 },
  centerText: { color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
