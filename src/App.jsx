import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, BarChart, BookOpen, Settings } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import VocabularyPage from "./pages/VocabularyPage";
import SettingsPage from "./pages/SettingsPage";
import { ENDPOINTS, createWebSocketConnection } from "./services/api";

function App() {
  const wsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [status, setStatus] = useState("connecting");
  const [offlineMode, setOfflineMode] = useState(false);
  const heartbeatIntervalRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

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

  // Set up WebSocket connection
  useEffect(() => {
    // Check if we're online
    if (!navigator.onLine) {
      setOfflineMode(true);
      setStatus("offline");
      return;
    }

    // Get custom WebSocket URL from localStorage if available
    const storedWsUrl = localStorage.getItem('serverUrl');
    const wsUrl = storedWsUrl || ENDPOINTS.ws;

    const connect = () => {
      // Create WebSocket connection
      wsRef.current = createWebSocketConnection(wsUrl);
      console.log("Creating WebSocket connection to:", wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected successfully");
        setStatus("connected");
        setOfflineMode(false);
        setWsConnected(true);
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("error");
        setWsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        console.log("WebSocket closed with code:", event?.code, "reason:", event?.reason);
        setStatus("closed");
        setWsConnected(false);
        
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

    return () => {
      if (wsRef.current) wsRef.current.close();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [offlineMode, reconnectWebSocket]);

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
      case 'vocabulary':
        return <VocabularyPage />;
      case 'settings':
        return <SettingsPage status={status} />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 text-gray-900">
      {/* Status bar for offline mode */}
      {offlineMode && (
        <div className="bg-yellow-500 text-white text-center text-sm py-1 px-4 safe-left safe-right">
          You're currently offline. Connect to the server to practice.
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