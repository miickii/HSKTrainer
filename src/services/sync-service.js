// src/services/sync-service.js
// This service handles synchronization between the server and local IndexedDB

import { vocabularyDB } from './db';
import { ENDPOINTS } from './api';

/**
 * SyncService provides methods to synchronize vocabulary data
 * between the backend server and local IndexedDB
 */
export const SyncService = {
  /**
   * Check if sync is needed
   * @returns {Promise<boolean>}
   */
  needsSync: async function() {
    try {
      // Check if sync flag is set in localStorage
      if (localStorage.getItem('needsSync') === 'true') {
        return true;
      }
      
      // Check if we have any words in local DB
      const localWords = await vocabularyDB.getAll();
      if (localWords.length === 0) {
        return true;
      }
      
      // Check when the last sync occurred
      const lastSync = localStorage.getItem('lastSync');
      if (!lastSync) {
        return true;
      }
      
      // If last sync was more than a day ago, sync again
      const lastSyncDate = new Date(lastSync);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      if (lastSyncDate < oneDayAgo) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error checking sync status:", error);
      return true; // Sync to be safe if there's an error
    }
  },
  
  /**
   * Synchronize vocabulary from the server to IndexedDB
   * @returns {Promise<{success: boolean, message: string, count: number}>}
   */
  synchronizeVocabulary: async function() {
    console.log("Starting vocabulary synchronization...");
    
    try {
      // Fetch vocabulary from server
      const response = await fetch(ENDPOINTS.vocabulary, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const serverWords = await response.json();
      console.log(`Received ${serverWords.length} words from server`);
      
      if (!Array.isArray(serverWords) || serverWords.length === 0) {
        throw new Error("Server returned empty or invalid vocabulary data");
      }
      
      // Get existing local words for comparison
      const localWords = await vocabularyDB.getAll();
      console.log(`Found ${localWords.length} words in local database`);
      
      // Build a map of local words by ID for quick lookup
      const localWordsMap = new Map();
      localWords.forEach(word => {
        localWordsMap.set(word.id, word);
      });
      
      // Process server words in batches to avoid transaction timeouts
      const processedCount = await vocabularyDB.syncFromServer(serverWords);
      
      // Update sync timestamp
      localStorage.setItem('lastSync', new Date().toISOString());
      localStorage.setItem('needsSync', 'false');
      
      return {
        success: true,
        message: `Successfully synchronized ${processedCount} words`,
        count: processedCount
      };
    } catch (error) {
      console.error("Vocabulary synchronization failed:", error);
      return {
        success: false,
        message: `Synchronization failed: ${error.message}`,
        count: 0
      };
    }
  },
  
  /**
   * Initialize synchronization on app startup
   * @returns {Promise<void>}
   */
  init: async function() {
    try {
      // Check if we're online
      if (!navigator.onLine) {
        console.log("Offline, skipping initial sync");
        return;
      }
      
      // Check if we need to sync
      const shouldSync = await this.needsSync();
      
      if (shouldSync) {
        console.log("Initial sync needed, starting synchronization...");
        await this.synchronizeVocabulary();
      } else {
        console.log("No initial sync needed");
      }
    } catch (error) {
      console.error("Error during sync initialization:", error);
    }
  }
};