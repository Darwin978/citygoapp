import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useCustomAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useCustomAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);
  
  const [scaleValue] = useState(new Animated.Value(0));
  const [opacityValue] = useState(new Animated.Value(0));

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    setOptions({ title, message, buttons });
    setVisible(true);
    
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
        speed: 14,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
  };

  const hideAlert = () => {
    Animated.parallel([
      Animated.timing(scaleValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      setVisible(false);
      setOptions(null);
    });
  };

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      setTimeout(() => {
        onPress();
      }, 200);
    }
  };

  const renderButtons = () => {
    const buttons = options?.buttons || [{ text: 'OK' }];

    if (buttons.length === 1) {
      return (
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={() => handleButtonPress(buttons[0].onPress)}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>{buttons[0].text}</Text>
        </TouchableOpacity>
      );
    }

    // For 2 buttons, render in a row
    if (buttons.length === 2) {
      return (
        <View style={styles.buttonRow}>
          {buttons.map((btn, index) => {
            const isCancel = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            
            let buttonStyle = [styles.button, styles.flexButton];
            let textStyle = [styles.buttonText];

            if (isDestructive) {
              buttonStyle.push(styles.destructiveButton as any);
              textStyle.push(styles.destructiveButtonText as any);
            } else if (isCancel) {
              buttonStyle.push(styles.cancelButton as any);
              textStyle.push(styles.cancelButtonText as any);
            } else {
              buttonStyle.push(styles.primaryButton as any);
              textStyle.push(styles.primaryButtonText as any);
            }

            const marginLeft = index > 0 ? 12 : 0;

            return (
              <TouchableOpacity 
                key={index} 
                style={[buttonStyle, { marginLeft }]} 
                onPress={() => handleButtonPress(btn.onPress)}
              >
                <Text style={textStyle}>{btn.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // For 3 or more buttons, render in a column
    return (
      <View style={styles.buttonColumn}>
        {buttons.map((btn, index) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          
          let buttonStyle = [styles.button, { marginBottom: index < buttons.length - 1 ? 10 : 0 }];
          let textStyle = [styles.buttonText];

          if (isDestructive) {
            buttonStyle.push(styles.destructiveButton as any);
            textStyle.push(styles.destructiveButtonText as any);
          } else if (isCancel) {
            buttonStyle.push(styles.cancelButton as any);
            textStyle.push(styles.cancelButtonText as any);
          } else {
            buttonStyle.push(styles.primaryButton as any);
            textStyle.push(styles.primaryButtonText as any);
          }

          return (
            <TouchableOpacity 
              key={index} 
              style={buttonStyle} 
              onPress={() => handleButtonPress(btn.onPress)}
            >
              <Text style={textStyle}>{btn.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={hideAlert}
      >
        <Animated.View style={[styles.overlay, { opacity: opacityValue }]}>
          <Animated.View style={[styles.alertBox, { transform: [{ scale: scaleValue }] }]}>
            {options?.title ? <Text style={styles.title}>{options.title}</Text> : null}
            {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
            
            <View style={styles.actionsContainer}>
              {renderButtons()}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Dark transparent background
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    backgroundColor: '#ffffff',
    width: '82%',
    maxWidth: 380,
    borderRadius: 24, // Rounder corners for modern look
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  actionsContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14, // Pill shape like
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#007AFF', // Action blue
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6', // Light gray
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: '#FEF2F2', // Light red
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  destructiveButtonText: {
    color: '#DC2626', // Red
    fontSize: 16,
    fontWeight: '600',
  },
});
