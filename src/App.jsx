import React, { useState, useEffect } from "react";
import { Mic, BookOpen, BarChart2, Settings, WifiOff } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import OfflinePracticePage from "./pages/OfflinePracticePage";
import VocabularyPage from "./pages/VocabularyPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import { AppProvider, useApp } from "./context/AppContext";

// Main App component that provides the context
function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

// App content that consumes the context
function AppContent() {
  const [activeTab, setActiveTab] = useState('practice');
  const { 
    offlineMode, 
    preferOfflinePractice, 
    wsConnected,
    status,
    detailViewActive,
    closeWordDetail
  } = useApp();

  // Handle back button for detail views
  useEffect(() => {
    const handleBackButton = (event) => {
      // If a detail view is open, close it instead of navigating back in browser history
      if (detailViewActive) {
        event.preventDefault();
        closeWordDetail();
      }
    };

    // Add event listener for popstate (back button)
    window.addEventListener('popstate', handleBackButton);
    
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [detailViewActive, closeWordDetail]);

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'practice':
        // Use offline practice if preferred or if we're offline with no WebSocket
        return (preferOfflinePractice || (offlineMode && !wsConnected)) ? (
          <OfflinePracticePage />
        ) : (
          <PracticePage />
        );
      case 'vocabulary':
        return <VocabularyPage />;
      case 'progress':
        return <ProgressPage />;
      case 'settings':
        return <SettingsPage />;
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