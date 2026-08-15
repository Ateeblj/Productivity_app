import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ⚠️ LEGACY / UNUSED: this is a pre-Supabase local-WebSocket-sync
// implementation. Nothing in the app currently imports this file — the
// active sync path is services/syncedStorage.ts + Supabase. Kept around
// for reference; the async-executor fix below just makes it parse
// correctly if anyone imports it in the future.
//
// ============================================================
// SYNC SERVICE - Local Network Sync without third-party services
// Handles WebSocket connections, data sync, and conflict resolution
// ============================================================

interface SyncMessage {
  type: 'sync' | 'update' | 'delete' | 'ping' | 'auth';
  dataType: string; // 'notes', 'tasks', 'goals', etc.
  payload: any;
  timestamp: number;
  deviceId: string;
}

interface SyncConfig {
  host: string; // IP address (e.g., '192.168.1.5')
  port: number; // WebSocket port (e.g., 9000)
  deviceId: string; // Unique device identifier
}

let ws: WebSocket | null = null;
let syncConfig: SyncConfig | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Track listeners for data changes
const syncListeners: Map<string, Function[]> = new Map();

export const syncService = {
  // Initialize as CLIENT - Connect to a remote server
  async connectAsClient(host: string, port: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const deviceId = await this.getDeviceId();
        syncConfig = { host, port, deviceId };

        const wsUrl = `ws://${host}:${port}`;
        console.log(`🔗 Connecting to sync server at ${wsUrl}...`);

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to sync server');
          reconnectAttempts = 0;
          
          // Send auth message
          this.send({
            type: 'auth',
            dataType: 'auth',
            payload: { role: 'client', deviceId },
            timestamp: Date.now(),
            deviceId,
          });

          resolve(true);
        };

        ws.onmessage = async (event) => {
          try {
            const message: SyncMessage = JSON.parse(event.data);
            await this.handleSyncMessage(message);
          } catch (error) {
            console.error('Error processing sync message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          resolve(false);
        };

        ws.onclose = () => {
          console.log('⚠️ Disconnected from sync server');
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('Error connecting as client:', error);
        resolve(false);
      }
    });
  },

  // Attempt to reconnect
  attemptReconnect(): void {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && syncConfig) {
      reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      
      setTimeout(() => {
        this.connectAsClient(syncConfig!.host, syncConfig!.port);
      }, RECONNECT_DELAY);
    }
  },

  // Send a sync message
  send(message: SyncMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending sync message:', error);
      }
    } else {
      console.warn('WebSocket not connected. Message not sent.');
    }
  },

  // Handle incoming sync messages
  async handleSyncMessage(message: SyncMessage): Promise<void> {
    try {
      const { type, dataType, payload, timestamp } = message;

      if (type === 'update') {
        // Save to local storage
        await AsyncStorage.setItem(dataType, JSON.stringify(payload));
        console.log(`📥 Received update for ${dataType}`);

        // Notify listeners
        this.notifyListeners(dataType, payload);
      } else if (type === 'delete') {
        // Remove from storage
        await AsyncStorage.removeItem(dataType);
        console.log(`📥 Received delete for ${dataType}`);
        this.notifyListeners(dataType, null);
      } else if (type === 'sync') {
        // Full sync request - send all local data
        await this.sendFullSync();
      }
    } catch (error) {
      console.error('Error handling sync message:', error);
    }
  },

  // Send full local sync to server
  async sendFullSync(): Promise<void> {
    try {
      const storageKeys = [
        'myNotes',
        'dailyTasks',
        'weeklyRoutineTasks',
        'monthlyEvents',
        'yearlyGoals',
        'local_users',
      ];

      const deviceId = await this.getDeviceId();
      for (const key of storageKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          this.send({
            type: 'update',
            dataType: key,
            payload: JSON.parse(data),
            timestamp: Date.now(),
            deviceId,
          });
        }
      }
      console.log('📤 Sent full sync to server');
    } catch (error) {
      console.error('Error sending full sync:', error);
    }
  },

  // Push local changes to connected peers
  async pushUpdate(dataType: string, data: any): Promise<void> {
    try {
      const deviceId = await this.getDeviceId();
      this.send({
        type: 'update',
        dataType,
        payload: data,
        timestamp: Date.now(),
        deviceId,
      });
      console.log(`📤 Pushed ${dataType} update to sync server`);
    } catch (error) {
      console.error('Error pushing update:', error);
    }
  },

  // Subscribe to data changes
  subscribe(dataType: string, callback: Function): () => void {
    if (!syncListeners.has(dataType)) {
      syncListeners.set(dataType, []);
    }
    syncListeners.get(dataType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = syncListeners.get(dataType);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  },

  // Notify all listeners of data changes
  notifyListeners(dataType: string, data: any): void {
    const listeners = syncListeners.get(dataType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in sync listener:', error);
        }
      });
    }
  },

  // Get unique device identifier
  async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      return `device_${Date.now()}`;
    }
  },

  // Check if connected
  isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  },

  // Disconnect
  disconnect(): void {
    if (ws) {
      ws.close();
      ws = null;
    }
  },

  // Get connection status
  getStatus(): string {
    if (!ws) return 'disconnected';
    if (ws.readyState === WebSocket.CONNECTING) return 'connecting';
    if (ws.readyState === WebSocket.OPEN) return 'connected';
    if (ws.readyState === WebSocket.CLOSING) return 'closing';
    return 'closed';
  },
};
