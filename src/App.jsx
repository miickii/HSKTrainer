import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, BookOpen, BarChart2, Settings, WifiOff } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import OfflinePracticePage from "./pages/OfflinePracticePage";
import VocabularyPage from "./pages/VocabularyPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import { ENDPOINTS, createWebSocketConnection } from "./services/api";

function App() {
  const wsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [status, setStatus] = useState("connecting");
  const [offlineMode, setOfflineMode] = useState(false);
  const [preferOfflinePractice, setPreferOfflinePractice] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Load user preferences
  useEffect(() => {
    try {
      const appSettings = localStorage.getItem('appSettings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        if (settings.preferOfflinePractice !== undefined) {
          setPreferOfflinePractice(settings.preferOfflinePractice);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  // Function to connect to WebSocket
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
        if (document.visibilityState === "visible" && navigator.onLine && !preferOfflinePractice) {
          connect();
        }
      }, 3000);
    };
  }, [preferOfflinePractice]);

  // Function to reconnect WebSocket
  const reconnectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CONNECTING) {
      console.log("Actively reconnecting WebSocket...");
      
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      
      connect();
    }
  }, [connect]);

  // Set up WebSocket connection
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
      setWsConnected(false);
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

  // Handle settings change
  useEffect(() => {
    const handleSettingsChange = (e) => {
      if (e.key === 'appSettings') {
        try {
          const settings = JSON.parse(e.newValue || '{}');
          if (settings.preferOfflinePractice !== undefined) {
            setPreferOfflinePractice(settings.preferOfflinePractice);
          }
        } catch (error) {
          console.error("Error parsing settings:", error);
        }
      }
    };
    
    window.addEventListener('storage', handleSettingsChange);
    
    return () => {
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, []);

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'practice':
        // Use offline practice if preferred or if we're offline with no WebSocket
        return (preferOfflinePractice || (offlineMode && !wsConnected)) ? (
          <OfflinePracticePage />
        ) : (
        <PracticePage 
          wsRef={wsRef} 
          offlineMode={offlineMode} 
          wsConnected={wsConnected}
          reconnectWebSocket={reconnectWebSocket}
        />
        );
      case 'vocabulary':
        return <VocabularyPage />;
      case 'progress':
        return <ProgressPage />;
      case 'settings':
        return <SettingsPage 
          status={status}
          offlineMode={offlineMode}
        />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 text-neutral-900">
      {/* Status bar for offline mode */}
      {offlineMode && !preferOfflinePractice && (
        <div className="bg-amber-500 text-white text-center text-xs py-1 px-4 safe-left safe-right">
          <div className="flex items-center justify-center">
            <WifiOff size={12} className="mr-1" />
            <span>You're currently offline. Limited features available.</span>
          </div>
        </div>
      )}
      
      {/* App Header - Optimized for iPhone notch with safe area */}
      <header className="bg-white py-4 px-4 safe-top safe-left safe-right border-b border-neutral-100">
        <h1 className="text-xl font-bold text-center text-neutral-900">HSK Master</h1>
      </header>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16 safe-left safe-right">
        {renderContent()}
      </main>
      
      {/* Bottom Navigation - with safe areas for iPhone */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-neutral-100 safe-bottom-nav">
        <div className="flex justify-around safe-left safe-right">
          <button 
            onClick={() => setActiveTab('practice')}
            className={`p-2 flex flex-col items-center ${activeTab === 'practice' ? 'text-red-500' : 'text-neutral-400'}`}
          >
            <Mic size={24} />
            <span className="text-xs mt-1">Practice</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('vocabulary')}
            className={`p-2 flex flex-col items-center ${activeTab === 'vocabulary' ? 'text-red-500' : 'text-neutral-400'}`}
          >
            <BookOpen size={24} />
            <span className="text-xs mt-1">Words</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('progress')}
            className={`p-2 flex flex-col items-center ${activeTab === 'progress' ? 'text-red-500' : 'text-neutral-400'}`}
          >
            <BarChart2 size={24} />
            <span className="text-xs mt-1">Progress</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-2 flex flex-col items-center ${activeTab === 'settings' ? 'text-red-500' : 'text-neutral-400'}`}
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