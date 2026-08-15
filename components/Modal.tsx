// components/Modal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal as RNModal,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import AnimatedPressable from './AnimatedPressable';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export default function Modal({ visible, onClose, title, children, showCloseButton = true }: ModalProps) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={showCloseButton ? onClose : () => {}}
      transparent={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
        {/* HEADER */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomColor: palette.border,
          borderBottomWidth: 1,
          backgroundColor: palette.surface,
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: palette.text,
            letterSpacing: 0.3,
          }}>
            {title}
          </Text>
          {showCloseButton && (
            <AnimatedPressable
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#EF4444',
              }}>
                ✕
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {/* CONTENT */}
        <View style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingVertical: 20,
        }}>
          {children}
        </View>
      </SafeAreaView>
    </RNModal>
  );
}