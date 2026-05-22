import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  socket: any;
  rideId: string | null;
  userId: string | null;
  initialMessages?: any[];
}

export default function ChatModal({ visible, onClose, socket, rideId, userId, initialMessages = [] }: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages.map((payload) => ({
        id: payload.id || Math.random().toString(),
        text: payload.text,
        sender: payload.senderId === userId ? 'me' : 'other',
        time: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })));
    }
  }, [initialMessages, userId]);

  useEffect(() => {
    if (!socket || !rideId || !userId) return;

    // Escuchar mensajes nuevos desde el servidor (SIEMPRE, incluso oculto)
    const handleNewMessage = (payload: any) => {
      const isMe = payload.senderId === userId;

      const incomingMsg = {
        id: payload.id || Math.random().toString(),
        text: payload.text,
        sender: isMe ? 'me' : 'other',
        time: new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => {
        // Evitar mensajes duplicados
        if (prev.some(m => m.id === incomingMsg.id)) return prev;
        return [...prev, incomingMsg];
      });
      
      // Intentar scroll, no pasa nada si está cerrado (ref es null)
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, rideId, userId]);

  const sendMessage = () => {
    if (inputText.trim() === '' || !socket || !rideId || !userId) return;

    const messageData = {
      rideId: rideId,
      senderId: userId,
      text: inputText,
    };

    socket.emit('send_message', messageData);
    setInputText('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.container}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top || 40 : insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#1D4ED8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat de la Carrera</Text>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, marginTop: 10 }}
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
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.emptyText}>Todavía no hay mensajes.</Text>}
        />

        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 15) }]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            value={inputText}
            onChangeText={setInputText}
            placeholderTextColor={'gray'}
            multiline
          />
          <TouchableOpacity style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} onPress={sendMessage} disabled={!inputText.trim()}>
            <Ionicons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: { marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  chatList: { padding: 20, paddingBottom: 40 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 10 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  otherBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 16 },
  myText: { color: 'white' },
  otherText: { color: '#374151' },
  timeText: { fontSize: 10, color: '#9CA3AF', marginTop: 5, alignSelf: 'flex-end' },
  inputArea: { flexDirection: 'row', padding: 15, backgroundColor: 'white', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, minHeight: 45, maxHeight: 110, color: '#111827' },
  sendBtn: { backgroundColor: '#1D4ED8', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendBtnDisabled: { backgroundColor: '#93A8D8' },
  emptyText: { color: '#6B7280', textAlign: 'center', marginTop: 40 }
});
