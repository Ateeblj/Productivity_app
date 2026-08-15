// services/mediaService.ts
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// For web, we store files as base64 strings in AsyncStorage
const WEB_STORAGE_KEY = 'web_media_files';

interface WebMediaFile {
  id: string;
  uri: string; // data:image/... or data:audio/... base64
  filename: string;
}

async function ensureDirExists(): Promise<void> {
  if (Platform.OS === 'web') {
    // No directory needed on web
    return;
  }
  const MEDIA_DIR = `${FileSystem.documentDirectory}notes_media/`;
  const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!dirInfo.exists) {
    console.log('[mediaService] Creating directory:', MEDIA_DIR);
    await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
}

export const mediaService = {
  async saveMedia(tempUri: string, extension: string): Promise<string> {
    try {
      console.log('[mediaService] Saving media (platform:', Platform.OS, ')');

      if (Platform.OS === 'web') {
        // On web, fetch the blob and store as base64
        const response = await fetch(tempUri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              const base64data = reader.result as string;
              const id = `media_${Date.now()}`;
              const filename = `${id}.${extension}`;
              
              const webFiles: WebMediaFile[] = JSON.parse(
                (await AsyncStorage.getItem(WEB_STORAGE_KEY)) || '[]'
              );
              
              const newFile: WebMediaFile = {
                id,
                uri: base64data,
                filename,
              };
              
              webFiles.push(newFile);
              await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(webFiles));
              
              // Return a fake URI that we can use to retrieve the file later
              const fakeUri = `web-media://${id}`;
              console.log('[mediaService] Web media saved with ID:', id);
              resolve(fakeUri);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      // Native: use expo-file-system
      const MEDIA_DIR = `${FileSystem.documentDirectory}notes_media/`;
      await ensureDirExists();
      const filename = `media_${Date.now()}.${extension}`;
      const destUri = `${MEDIA_DIR}${filename}`;
      console.log('[mediaService] Copying from', tempUri, 'to', destUri);
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      console.log('[mediaService] Copy successful');
      return destUri;
    } catch (error) {
      console.error('[mediaService] Error saving media:', error);
      throw error;
    }
  },

  async deleteMedia(uri?: string | null): Promise<void> {
    if (!uri) return;
    
    if (Platform.OS === 'web' && uri.startsWith('web-media://')) {
      // Delete from web storage
      const id = uri.replace('web-media://', '');
      try {
        const webFiles: WebMediaFile[] = JSON.parse(
          (await AsyncStorage.getItem(WEB_STORAGE_KEY)) || '[]'
        );
        const filtered = webFiles.filter(f => f.id !== id);
        await AsyncStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(filtered));
        console.log('[mediaService] Web media deleted:', id);
      } catch (err) {
        console.error('[mediaService] Error deleting web media:', err);
      }
      return;
    }

    // Native: delete from file system
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('[mediaService] Deleted:', uri);
      }
    } catch (error) {
      console.error('[mediaService] Error deleting media:', error);
    }
  },

  // Helper to get web media content
  async getWebMedia(id: string): Promise<string | null> {
    try {
      const webFiles: WebMediaFile[] = JSON.parse(
        (await AsyncStorage.getItem(WEB_STORAGE_KEY)) || '[]'
      );
      const file = webFiles.find(f => f.id === id);
      return file?.uri || null;
    } catch (err) {
      console.error('[mediaService] Error getting web media:', err);
      return null;
    }
  },
};