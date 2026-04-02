import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MessagesScreen() {
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hola, ya estoy en el punto de encuentro.', sender: 'driver', time: '10:30' },
    { id: '2', text: 'Perfecto, bajo en 2 minutos.', sender: 'client', time: '10:31' },
  ]);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (inputText.trim() === '') return;
    const newMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'client', // Esto cambiaría según el rol
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMessage]);
    setInputText('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      keyboardVerticalOffset={90}
      style={styles.container}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble, 
            item.sender === 'client' ? styles.clientBubble : styles.driverBubble
          ]}>
            <Text style={[
              styles.messageText, 
              item.sender === 'client' ? styles.clientText : styles.driverText
            ]}>
              {item.text}
            </Text>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        )}
        contentContainerStyle={styles.chatList}
      />

      <View style={styles.inputArea}>
        <TextInput 
          style={styles.input} 
          placeholder="Escribe un mensaje..."
          value={inputText}
          onChangeText={setInputText}
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
  chatList: { padding: 20 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 10 },
  clientBubble: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8' },
  driverBubble: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  messageText: { fontSize: 16 },
  clientText: { color: 'white' },
  driverText: { color: '#374151' },
  timeText: { fontSize: 10, color: '#9CA3AF', marginTop: 5, alignSelf: 'flex-end' },
  inputArea: { flexDirection: 'row', padding: 15, backgroundColor: 'white', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 25, paddingHorizontal: 20, height: 45 },
  sendBtn: { backgroundColor: '#1D4ED8', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});