// components/VideoRecorderModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, Platform, Alert } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';

interface VideoRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string, durationSec: number) => void;
}

const VideoRecorderModal: React.FC<VideoRecorderModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const isRecordingRef = useRef(false);
  // When true, the pending recordAsync() promise resolves without calling onSave.
  // Only stopRecording() (the explicit "stop & save" action) should leave this false.
  const discardRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!visible && isRecordingRef.current) {
      discardRef.current = true;
      cameraRef.current?.stopRecording();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isRecordingRef.current) {
        discardRef.current = true;
        cameraRef.current?.stopRecording();
      }
    };
  }, [visible]);

  const ensurePermissions = async (): Promise<boolean> => {
    let camGranted = cameraPermission?.granted;
    let micGranted = micPermission?.granted;
    if (!camGranted) {
      const res = await requestCameraPermission();
      camGranted = res.granted;
    }
    if (!micGranted) {
      const res = await requestMicPermission();
      micGranted = res.granted;
    }
    return !!(camGranted && micGranted);
  };

  const startRecording = async () => {
    // Check platform – recording is not supported on web
    if (Platform.OS === 'web') {
      Alert.alert(
        'Not Supported',
        'Video recording is not available on web. Please use the app on a mobile device (Android/iOS).'
      );
      return;
    }

    const ok = await ensurePermissions();
    if (!ok || !cameraRef.current) {
      Alert.alert('Permission Denied', 'Camera or microphone permission is required to record video.');
      return;
    }

    setIsRecording(true);
    setElapsed(0);
    elapsedRef.current = 0;
    discardRef.current = false;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);

      if (discardRef.current) {
        // Closed/cancelled while recording – don't save the clip.
        discardRef.current = false;
        console.log('🗑️ Recording discarded');
        return;
      }

      if (video?.uri) {
        console.log('✅ Video saved, URI:', video.uri, 'Duration:', elapsedRef.current);
        onSave(video.uri, elapsedRef.current);
      } else {
        console.error('❌ No video URI returned');
        Alert.alert('Error', 'Failed to capture video – no file returned.');
      }
    } catch (error) {
      console.error('Video recording error:', error);
      Alert.alert('Recording Error', (error as Error).message || 'An error occurred while recording.');
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = () => {
    // Explicit "stop & save" – discardRef stays false so the pending
    // recordAsync() promise in startRecording() calls onSave.
    discardRef.current = false;
    cameraRef.current?.stopRecording();
  };

  const handleClose = () => {
    if (isRecording) {
      // Closing while recording is a cancel, not a save.
      discardRef.current = true;
      cameraRef.current?.stopRecording();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(0);
    setIsRecording(false);
    onClose();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!visible) return null;

  if (!cameraPermission || !micPermission) {
    return null;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <RNModal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <View className="flex-1 items-center justify-center bg-black px-8">
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 }}>
            Camera & microphone access needed to record video notes
          </Text>
          <TouchableOpacity
            onPress={ensurePermissions}
            className="bg-blue-600 px-6 py-3.5 rounded-xl mb-3"
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} className="px-6 py-3">
            <Text style={{ color: '#9CA3AF', fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </RNModal>
    );
  }

  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black">
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} mode="video" />

        {/* Top bar */}
        <View className="absolute top-12 left-0 right-0 flex-row justify-between px-5">
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
          >
            <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>

          {isRecording && (
            <View className="flex-row items-center bg-black/50 px-3 py-1.5 rounded-full">
              <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>{formatTime(elapsed)}</Text>
            </View>
          )}

          {!isRecording && Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
            >
              <Text style={{ color: '#fff', fontSize: 18 }}>🔄</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom controls */}
        <View className="absolute bottom-12 left-0 right-0 items-center">
          {Platform.OS === 'web' ? (
            // On web, show a disabled button with a note
            <View className="items-center">
              <TouchableOpacity
                disabled
                className="w-20 h-20 rounded-full border-4 border-gray-500 items-center justify-center bg-gray-700 opacity-50"
              >
                <View className="w-16 h-16 rounded-full bg-gray-500" />
              </TouchableOpacity>
              <Text className="text-gray-400 text-xs mt-4 text-center px-4">
                Video recording is not available on web. Please use a mobile device.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
            >
              <View
                className={
                  isRecording
                    ? 'w-8 h-8 rounded-md bg-red-500'
                    : 'w-16 h-16 rounded-full bg-red-500'
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </RNModal>
  );
};

export default VideoRecorderModal;