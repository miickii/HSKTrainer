import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, BarChart, BookOpen, Settings } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import ProgressPage from "./pages/ProgressPage";
import VocabularyPage from "./pages/VocabularyPage";
import SettingsPage from "./pages/SettingsPage";
import { vocabularyDB } from "./services/db";
import { ENDPOINTS, createWebSocketConnection, fetchVocabulary } from "./services/api";
import { WebSocketUtils } from "./services/websocket-utils";

function App() {
  const wsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [status, setStatus] = useState("connecting");
  const [offlineMode, setOfflineMode] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const deferredPromptRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Check if the app is being used in standalone mode (installed as PWA)
  const isInStandaloneMode = () => 
    (window.matchMedia('(display-mode: standalone)').matches) || 
    (window.navigator.standalone) || 
    document.referrer.includes('android-app://');

  // Function to reconnect WebSocket
  const reconnectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CONNECTING) {
      console.log("Actively reconnecting WebSocket...");
      
      // Close the existing connection if it's not already closed
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      
      // Create a new connection
      connect();
    }
  }, []);

  // Start heartbeat to keep connection alive
  const startHeartbeat = () => {
    stopHeartbeat(); // Clear any existing interval
    
    // Send a ping every 30 seconds to keep the connection alive
    heartbeatIntervalRef.current = setInterval(async () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("Sending WebSocket heartbeat");
        try {
          // Using the new WebSocketUtils for heartbeat
          await WebSocketUtils.sendHeartbeat(wsRef.current);
          console.log("Heartbeat successful");
        } catch (err) {
          console.error("Heartbeat failed:", err.message);
          stopHeartbeat();
          reconnectWebSocket();
        }
      } else {
        // If the connection is not open, try to reconnect
        console.log("Heartbeat failed - connection not open");
        stopHeartbeat();
        reconnectWebSocket();
      }
    }, 30000); // 30 seconds
  };

  // Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const syncVocabularyIfNeeded = useCallback(async () => {
    const needsSync = localStorage.getItem('needsSync');
    
    if (needsSync === 'true' && navigator.onLine) {
      console.log("Syncing vocabulary after reset...");
      await syncVocabulary();
      localStorage.removeItem('needsSync');
    }
  }, []);

  // Set up WebSocket connection
  useEffect(() => {
    // Check if we're online
    if (!navigator.onLine) {
      setOfflineMode(true);
      setStatus("offline");
      return;
    }

    syncVocabularyIfNeeded();

    const connect = () => {
      // Use the API service to create WebSocket connection
      wsRef.current = createWebSocketConnection();
      console.log("Creating WebSocket connection to:", ENDPOINTS.ws);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected successfully");
        setStatus("connected");
        setOfflineMode(false);
        setWsConnected(true);
        startHeartbeat();
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
        setWsConnected(false);
        stopHeartbeat();
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket closed with code:", event?.code, "reason:", event?.reason);
        setStatus("closed");
        setWsConnected(false);
        stopHeartbeat();
        
        // Try to reconnect after a delay if page is still open
        setTimeout(() => {
          if (document.visibilityState === "visible" && navigator.onLine) {
            connect();
          }
        }, 3000);
      };
    };

    connect();

    // Handle going offline
    const handleOffline = () => {
      setOfflineMode(true);
      setStatus("offline");
      setWsConnected(false);
      stopHeartbeat();
    };

    // Handle coming back online
    const handleOnline = () => {
      // Only try to reconnect if we were previously offline
      if (offlineMode) {
        // Wait a bit to make sure network is stable
        setTimeout(() => {
          connect();
          setStatus("connecting");
        }, 1000);
      }
    };

    // Handle visibility change to reconnect when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine && 
          (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        connect();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial sync to local database (if online)
    if (navigator.onLine) {
      syncVocabulary();
    }

    // If the app is not in standalone mode, show install prompt
    if (!isInStandaloneMode()) {
      // Listen for beforeinstallprompt event
      window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPromptRef.current = e;
        // Show install button
        setShowInstallPrompt(true);
      });
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      stopHeartbeat();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [offlineMode, reconnectWebSocket, syncVocabularyIfNeeded]);

  // Function to sync vocabulary with server
  const syncVocabulary = async () => {
    try {
      console.log("Syncing vocabulary from server...");
      
      try {
        // Using the updated fetchVocabulary function
        const data = await fetchVocabulary();
        console.log(`Received ${data.length} vocabulary words from server`);
        
        // Sync data to IndexedDB
        if (data.length > 0) {
          try {
            const processedCount = await vocabularyDB.syncFromServer(data);
            console.log(`Vocabulary sync completed: ${processedCount} words updated`);
          } catch (dbError) {
            console.error('IndexedDB sync error:', dbError);
            // This is not fatal, as we may have partially updated the database
          }
        }
      } catch (error) {
        console.error('Failed to sync vocabulary:', error);
      }
    } catch (error) {
      console.error('Failed to sync vocabulary:', error);
    }
  };

  // Handle install button click
  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      // Show the install prompt
      deferredPromptRef.current.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPromptRef.current.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      
      // Clear the saved prompt since it can't be used again
      deferredPromptRef.current = null;
      
      // Hide the install button
      setShowInstallPrompt(false);
    }
  };

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'practice':
        return <PracticePage 
          wsRef={wsRef} 
          offlineMode={offlineMode} 
          wsConnected={wsConnected}
          reconnectWebSocket={reconnectWebSocket}
        />;
      case 'progress':
        return <ProgressPage />;
      case 'vocabulary':
        return <VocabularyPage 
          wsRef={wsRef} 
          offlineMode={offlineMode}
          wsConnected={wsConnected}
        />;
      case 'settings':
        return <SettingsPage status={status} offlineMode={offlineMode} />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 text-gray-900">
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="bg-blue-500 text-white p-2 text-center">
          <button 
            onClick={handleInstallClick}
            className="text-sm font-medium"
          >
            Install HSK Master for offline use
          </button>
        </div>
      )}
      
      {/* Status bar for offline mode */}
      {offlineMode && (
        <div className="bg-yellow-500 text-white text-center text-sm py-1 px-4 safe-left safe-right">
          You're currently offline. Some features may be limited.
        </div>
      )}
      
      {/* Connection status indicator for debugging */}
      {status !== "connected" && !offlineMode && (
        <div className="bg-blue-100 text-blue-800 text-center text-sm py-1 px-4 safe-left safe-right">
          Connection status: {status}
        </div>
      )}
      
      {/* App Header - Optimized for iPhone notch with safe area */}
      <header className="bg-white shadow-sm py-4 px-4 safe-top safe-left safe-right">
        <h1 className="text-xl font-bold text-center">HSK Master</h1>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16 safe-left safe-right">
        {renderContent()}
      </main>
      
      {/* Bottom Navigation - with safe areas for iPhone */}
      <nav className="fixed bottom-0 w-full bg-white shadow-lg safe-bottom-nav">
        <div className="flex justify-around safe-left safe-right">
          <button 
            onClick={() => setActiveTab('practice')}
            className={`p-3 flex flex-col items-center ${activeTab === 'practice' ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <Mic size={24} />
            <span className="text-xs mt-1">Practice</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('progress')}
            className={`p-3 flex flex-col items-center ${activeTab === 'progress' ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <BarChart size={24} />
            <span className="text-xs mt-1">Progress</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('vocabulary')}
            className={`p-3 flex flex-col items-center ${activeTab === 'vocabulary' ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <BookOpen size={24} />
            <span className="text-xs mt-1">Words</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-3 flex flex-col items-center ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <Settings size={24} />
            <span className="text-xs mt-1">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;