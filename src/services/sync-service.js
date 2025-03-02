// src/services/sync-service.js
// Simplified sync service for offline-first functionality

import { vocabularyDB } from './db';
import { ENDPOINTS, fetchVocabulary } from './api';

/**
 * SyncService provides methods to download and manage vocabulary data
 * between the backend server and local IndexedDB
 */
export const SyncService = {
  /**
   * Check if initial database download is needed
   * @returns {Promise<boolean>}
   */
  needsInitialSetup: async function() {
    try {
      // Check if we have any words in local DB
      const localWords = await vocabularyDB.getAll();
      if (localWords.length === 0) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Error checking initial setup status:", error);
      return true; // Assume we need setup if there's an error
    }
  },
  
  /**
   * Download the full database from server
   * @returns {Promise<{success: boolean, message: string, count: number}>}
   */
  downloadFullDatabase: async function() {
    console.log("Starting full database download...");
    
    try {
      // Check if we're online
      if (!navigator.onLine) {
        throw new Error("Cannot download database while offline");
      }
      
      // Fetch vocabulary from server
      const response = await fetch(ENDPOINTS.vocabulary, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      let vocabulary = []
      if (response.ok) {
        vocabulary = await response.json();
        console.log(`Received ${vocabulary.length} words from server`);
      }
      
      if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
        throw new Error("Server returned empty or invalid vocabulary data");
      }
      
      console.log(`Received ${vocabulary.length} words from server`);
      
      // Import data to local database
      const wordCount = await vocabularyDB.importFromServer(vocabulary);
      
      // Update last download timestamp
      localStorage.setItem('lastDatabaseDownload', new Date().toISOString());
      
      return {
        success: true,
        count: wordCount
      };
    } catch (error) {
      console.error("Database download failed:", error);
      return {
        success: false,
        message: `Database download failed: ${error.message}`,
        count: 0
      };
    }
  },
  
  /**
   * Initialize application on first run
   * @returns {Promise<void>}
   */
  init: async function() {
    try {
      // Check if we need initial setup
      const needsSetup = await this.needsInitialSetup();
      
      if (needsSetup) {
        console.log("Initial setup needed, downloading database...");
        
        // Check if we're online
        if (!navigator.onLine) {
          console.log("Offline, can't perform initial setup");
          localStorage.setItem('needsSetup', 'true'); // Flag for later
          return;
        }
        
        // Download full database
        const result = await this.downloadFullDatabase();
        
        if (result.success) {
          console.log("Initial setup completed successfully");
          localStorage.removeItem('needsSetup');
        } else {
          console.error("Initial setup failed:", result.message);
          localStorage.setItem('needsSetup', 'true'); // Try again later
        }
      } else {
        console.log("No initial setup needed, database already exists");
      }
    } catch (error) {
      console.error("Error during initialization:", error);
      localStorage.setItem('needsSetup', 'true'); // Try again later
    }
  }
};