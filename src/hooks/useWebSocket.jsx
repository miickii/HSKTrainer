// src/hooks/useWebSocket.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { createWebSocketConnection, ENDPOINTS } from '../services/api';

export function useWebSocket(preferOfflinePractice = false) {
    const [status, setStatus] = useState("connecting");
    const [connected, setConnected] = useState(false);
    const [offlineMode, setOfflineMode] = useState(false);
    const wsRef = useRef(null);
  
    const connect = useCallback(() => {
      // Only attempt connection if not in offline practice mode
      if (preferOfflinePractice) {
        console.log("Using offline practice mode, not connecting to WebSocket");
        return;
      }
      
      // Check if we're online
      if (!navigator.onLine) {
        setOfflineMode(true);
        setStatus("offline");
        return;
      }
      
      // Create WebSocket connection
      wsRef.current = createWebSocketConnection(
        localStorage.getItem('wsUrl') || ENDPOINTS.ws
      );
      console.log("Creating WebSocket connection to:", wsRef.current.url);
  
      wsRef.current.onopen = () => {
        console.log("WebSocket connected successfully");
        setStatus("connected");
        setOfflineMode(false);
        setConnected(true);
      };
  
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
        setConnected(false);
      };
  
      wsRef.current.onclose = (event) => {
        console.log("WebSocket closed with code:", event?.code, "reason:", event?.reason);
        setStatus("closed");
        setConnected(false);
        
        // Try to reconnect after a delay if page is still open
        setTimeout(() => {
          if (document.visibilityState === "visible" && navigator.onLine && !preferOfflinePractice) {
            connect();
          }
        }, 3000);
      };
    }, [preferOfflinePractice]);
  
    const reconnect = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CONNECTING) {
            console.log("Actively reconnecting WebSocket...");
            
            if (wsRef.current.readyState !== WebSocket.CLOSED) {
            wsRef.current.close();
            }
            
            connect();
        }
    }, [connect]);
  
  // Effect for connection management
    useEffect(() => {
        if (preferOfflinePractice) {
            console.log("Using offline practice mode, not connecting to WebSocket");
            return;
        }
        
        if (!navigator.onLine) {
            setOfflineMode(true);
            setStatus("offline");
            return;
        }
    
        connect();
    
        const handleOffline = () => {
            setOfflineMode(true);
            setStatus("offline");
            setConnected(false);
        };
    
        const handleOnline = () => {
            if (offlineMode && !preferOfflinePractice) {
            setTimeout(() => {
                connect();
                setStatus("connecting");
            }, 1000);
            }
        };
    
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible" && navigator.onLine && 
                (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) && 
                !preferOfflinePractice) {
            connect();
            }
        };
    
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);
    
        return () => {
            if (wsRef.current) wsRef.current.close();
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [offlineMode, connect, preferOfflinePractice]);
  
    return {
        wsRef,
        status,
        connected,
        offlineMode,
        reconnect
    };
}