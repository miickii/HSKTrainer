// src/services/api.js - API endpoints and REST operations

// Get API URLs from environment variables or use defaults
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// API endpoints
export const ENDPOINTS = {
  // WebSocket endpoint
  ws: `${WS_URL}/ws/api`,
  
  // REST API endpoints
  vocabulary: `${API_URL}/api/vocabulary`,
  downloadVocabulary: `${API_URL}/api/download-vocabulary`,
  updateWord: (wordId) => `${API_URL}/api/update-word/${wordId}`,
  toggleFavorite: (wordId) => `${API_URL}/api/toggle-favorite/${wordId}`,
  transcribe: `${API_URL}/api/transcribe`,
  
  // Health check
  health: `${API_URL}/health`
};

// Utility function to check if API is available
export const checkApiConnection = async () => {
  try {
    const response = await fetch(ENDPOINTS.health, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.error('API connection check failed:', error);
    return false;
  }
};

// REST API functions
/**
 * Fetch vocabulary data from the server
 * @returns {Promise<Array>} The vocabulary data
 */
export const fetchVocabulary = async () => {
  try {
    const response = await fetch(ENDPOINTS.downloadVocabulary);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch vocabulary:', error);
    throw error;
  }
};

// WebSocket message types (for reference)
export const WS_MESSAGE_TYPES = {
  GET_SAMPLE_WORDS: 'get_sample_words',
  UPLOAD_AUDIO: 'upload_audio',
  SAMPLE_SENTENCE: 'sample_sentence',
  AUDIO_UPLOAD_ACK: 'audio_upload_ack',
  ERROR: 'error'
};

/**
 * Create a WebSocket connection
 * @param {string} url - Optional custom WebSocket URL
 * @returns {WebSocket} The WebSocket connection
 */
export const createWebSocketConnection = (url = null) => {
  // Use provided URL or default from ENDPOINTS
  const wsUrl = url || ENDPOINTS.ws;
  return new WebSocket(wsUrl);
};