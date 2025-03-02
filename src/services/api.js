// src/services/api.js - Simplified API endpoints for offline-first approach

// Get API URLs from localStorage first, then environment variables, then defaults
const API_URL = localStorage.getItem('serverUrl') || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_URL = localStorage.getItem('wsUrl') || import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/api';

// For debugging
console.log(`Using API_URL: ${API_URL}`);
console.log(`Using WS_URL: ${WS_URL}`);

// API endpoints
export const ENDPOINTS = {
  // WebSocket endpoint
  ws: WS_URL,
  
  // REST API endpoints
  vocabulary: `${API_URL}/api/vocabulary`,
  transcribe: `${API_URL}/api/transcribe`,
  
  // Health check
  health: `${API_URL}/health`
};

// Utility function to check if API is available
export const checkApiConnection = async () => {
  try {
    const response = await fetch(ENDPOINTS.health, { 
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      // Short timeout to prevent long waits
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch (error) {
    console.error('API connection check failed:', error);
    return false;
  }
};

export const fetchVocabulary = async () => {
  try {
    const response = await fetch(ENDPOINTS.vocabulary);
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats (array directly or nested in an object)
    const words = Array.isArray(data) ? data : 
                  (data && Array.isArray(data.words)) ? data.words : [];
    
    if (words.length === 0) {
      console.warn("No vocabulary words received from server");
    }
    
    return words;
  } catch (error) {
    console.error('Failed to fetch vocabulary:', error);
    throw error;
  }
};

/**
 * Create a WebSocket connection
 * @param {string} url - Optional custom WebSocket URL
 * @returns {WebSocket} The WebSocket connection
 */
export const createWebSocketConnection = (url = null) => {
  // Use provided URL or default from ENDPOINTS
  const wsUrl = url || ENDPOINTS.ws;
  
  console.log(`Creating WebSocket connection to ${wsUrl}`);
  return new WebSocket(wsUrl);
};