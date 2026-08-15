// components/SplashVideo.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const videoRef = useRef<Video>(null);
  const [isReady, setIsReady] = useState(false);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    SplashScreen.hideAsync().catch(() => {});
    onFinish();
  };

  // Hard timeout — video missing/corrupt must not block the app
  useEffect(() => {
    const t = setTimeout(finish, 4000);
    return () => clearTimeout(t);
  }, []);

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status?.isLoaded) {
      if (!isReady) {
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
      if (status.didJustFinish) {
        finish();
      }
    } else if (status?.error) {
      console.warn('[SplashVideo] playback error', status.error);
      finish();
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={require('../assets/splash.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(e) => {
          console.warn('[SplashVideo] onError', e);
          finish();
        }}
      />
      {!isReady && (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Starting…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  video: {
    width,
    height,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '600',
  },
});
