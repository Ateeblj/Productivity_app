// components/VoiceRecorderModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Audio } from 'expo-av';
import Modal from './Modal';
import { useTheme } from '../context/ThemeContext';

interface VoiceRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string, durationSec: number) => void;
}

const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { isDark } = useTheme();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [permissionError, setPermissionError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    if (!visible) {
      cleanup();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  const cleanup = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setElapsed(0);
    setIsRecording(false);
    setPermissionError('');
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
      setRecording(null);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionError('Microphone permission is required to record voice notes.');
        return;
      }
      setPermissionError('');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setPermissionError('Could not start recording. Please try again.');
    }
  };

  const stopAndSave = async () => {
    if (!recordingRef.current) {
      console.warn('No recording to stop');
      return;
    }
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const duration = elapsed;

      recordingRef.current = null;
      setRecording(null);
      setElapsed(0);

      console.log('[VoiceRecorder] Stopped. URI:', uri, 'Duration:', duration);

      if (uri) {
        // Call the parent's onSave
        onSave(uri, duration);
        // Note: we don't close the modal here – parent will close it after saving.
        // But we can show a quick success message.
        Alert.alert('✅ Success', 'Voice recording saved!');
      } else {
        console.error('[VoiceRecorder] No URI returned');
        setPermissionError('Recording failed – no file created.');
        Alert.alert('❌ Error', 'Could not get recording file.');
      }
    } catch (error) {
      console.error('[VoiceRecorder] Error stopping/saving:', error);
      setPermissionError('Error saving recording.');
      Alert.alert('❌ Error', 'Failed to save voice recording.');
    }
  };

  const cancelRecording = async () => {
    await cleanup();
    onClose();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Modal
      visible={visible}
      onClose={cancelRecording}
      title="Voice Note"
      showCloseButton={!isRecording}
    >
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            backgroundColor: isRecording ? '#EF4444' : isDark ? '#3B82F6' : '#2563EB',
          }}
        >
          <Text style={{ fontSize: 36 }}>{isRecording ? '⏺' : '🎙'}</Text>
        </View>

        <Text style={{ fontSize: 32, fontWeight: '700', color: isDark ? '#F0ECF7' : '#1A1620', marginBottom: 8 }}>
          {formatTime(elapsed)}
        </Text>

        {permissionError ? (
          <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 }}>
            {permissionError}
          </Text>
        ) : (
          <Text style={{ color: isDark ? '#A098B0' : '#6B7280', marginBottom: 24 }}>
            {isRecording ? 'Recording...' : 'Tap the mic to start recording'}
          </Text>
        )}

        {!isRecording ? (
          <TouchableOpacity
            onPress={startRecording}
            style={{
              backgroundColor: isDark ? '#3B82F6' : '#2563EB',
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Start Recording</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={cancelRecording}
              style={{
                backgroundColor: isDark ? '#262030' : '#E5E0EA',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: isDark ? '#F0ECF7' : '#374151', fontWeight: '700' }}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={stopAndSave}
              style={{
                backgroundColor: '#EF4444',
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Stop & Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default VoiceRecorderModal;