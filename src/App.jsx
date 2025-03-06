import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Mic, BookOpen, BarChart2, Settings, WifiOff, Home } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import OfflinePracticePage from "./pages/OfflinePracticePage";
import VocabularyPage from "./pages/VocabularyPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import GameSelectionPage from "./pages/GameSelectionPage";
import ComponentBuilderPage from "./pages/ComponentBuilderPage";
import { AppProvider, useApp } from "./context/AppContext";

// Main App component that provides the context
function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

// Navigation component extracted to be used with routing
function Navigation() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Don't show navigation on the game selection screen
  if (currentPath === "/game-selection" || 
      currentPath === "/component-builder") {
    return null;
  }
  
  // Maps paths to tabs
  const pathToTab = {
    "/practice": "practice",
    "/vocabulary": "vocabulary",
    "/progress": "progress",
    "/settings": "settings"
  };
  
  const activeTab = pathToTab[currentPath] || "practice";
  
  return (
    <nav className="fixed bottom-0 w-full bg-white border-t border-neutral-100 safe-bottom-nav">
      <div className="flex justify-around safe-left safe-right">
        <RouterTab 
          icon={<Home size={24} />} 
          label="Games"
          to="/game-selection"
          isActive={currentPath === "/game-selection"}
        />
        
        <RouterTab 
          icon={<Mic size={24} />} 
          label="Practice"
          to="/practice"
          isActive={activeTab === "practice"}
        />
        
        <RouterTab 
          icon={<BookOpen size={24} />} 
          label="Words"
          to="/vocabulary"
          isActive={activeTab === "vocabulary"}
        />
        
        <RouterTab 
          icon={<BarChart2 size={24} />} 
          label="Progress"
          to="/progress"
          isActive={activeTab === "progress"}
        />
        
        <RouterTab 
          icon={<Settings size={24} />} 
          label="Settings"
          to="/settings"
          isActive={activeTab === "settings"}
        />
      </div>
    </nav>
  );
}

// RouterTab component
function RouterTab({ icon, label, to, isActive }) {
  const color = isActive ? "text-red-500" : "text-neutral-400";
  
  return (
    <a href={`#${to}`} className={`p-2 flex flex-col items-center ${color}`}>
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </a>
  );
}

// App content that consumes the context
function AppContent() {
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

  // Determine which practice component to use
  const PracticeComponent = (preferOfflinePractice || (offlineMode && !wsConnected)) 
    ? OfflinePracticePage 
    : PracticePage;

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
        <Routes>
          <Route path="/game-selection" element={<GameSelectionPage />} />
          <Route path="/practice" element={<PracticeComponent />} />
          <Route path="/vocabulary" element={<VocabularyPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/component-builder" element={<ComponentBuilderPage />} />
          <Route path="*" element={<Navigate to="/game-selection" replace />} />
        </Routes>
      </main>
      
      {/* Bottom Navigation - with safe areas for iPhone */}
      <Navigation />
    </div>
  );
}

export default App;