import React, { useRef, useEffect, useState, useCallback } from "react";
import { Mic, BookOpen, BarChart2, Settings, WifiOff } from "lucide-react";
import PracticePage from "./pages/PracticePage";
import OfflinePracticePage from "./pages/OfflinePracticePage";
import VocabularyPage from "./pages/VocabularyPage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import { ENDPOINTS, createWebSocketConnection } from "./services/api";
import { vocabularyDB } from "./services/db";

function App() {
  const wsRef = useRef(null);
  const [activeTab, setActiveTab] = useState('practice');
  const [status, setStatus] = useState("connecting");
  const [offlineMode, setOfflineMode] = useState(false);
  const [preferOfflinePractice, setPreferOfflinePractice] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const [vocabularyWords, setVocabularyWords] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [currentExample, setCurrentExample] = useState(null);
  const [vocabLoading, setVocabLoading] = useState(true);

  const loadVocabulary = useCallback(async () => {
    try {
      // Only load if not already loaded
      if (vocabularyWords.length === 0) {
        setVocabLoading(true);
        
        // Load from IndexedDB
        let data = await vocabularyDB.getAll();
        
        if (data.length > 0) {
          // Sort words by level and then by simplified character
          data.sort((a, b) => {
            if (a.level !== b.level) {
              return a.level - b.level;
            }
            return a.simplified.localeCompare(b.simplified, 'zh-CN');
          });
  
          // Pre-parse examples to avoid doing it repeatedly
          data.forEach(word => {
            try {
              word.examples = JSON.parse(word.examples || '[]');
            } catch (e) {
              word.examples = [];
              console.error("Error parsing examples for word:", word.id);
            }
          });
          
          setVocabularyWords(data);

        }
        
        setVocabLoading(false);
      }
    } catch (error) {
      console.error("Error loading vocabulary:", error);
      setVocabLoading(false);
    }
  }, [vocabularyWords.length]);
  
  // Add this effect to load vocabulary when app starts
  useEffect(() => {
    loadVocabulary();
    selectNewWord([1, 2, 3, 4, 5, 6, 7])
  }, [loadVocabulary]);
  
  // Load user preferences and vocabulary
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
  });

  const getExamplesFromWord = (word) => {
    if (!word || !word.examples) return [];
    return word.examples;
  };
  
  // Function to select a new word (move this from practice pages)
  const selectNewWord = useCallback(async (hskLevels, showOnlySrsLevel0 = false) => {
    try {
      let word = null;
      
      // Check if we have vocabulary loaded
      if (vocabularyWords.length === 0) {
        await loadVocabulary();
      }
      
      if (showOnlySrsLevel0) {
        // Get all words for the selected HSK levels with SRS level 0
        const srsLevel0Words = vocabularyWords.filter(word => {
          // Check HSK level and SRS level is 0
          if (!hskLevels.includes(word.level) || word.srsLevel !== 0) return false;
          // Check for examples
          return Array.isArray(word.examples) && word.examples.length > 0;
        });
        
        if (srsLevel0Words.length > 0) {
          // Choose a random word from the filtered list
          const randomIndex = Math.floor(Math.random() * srsLevel0Words.length);
          word = srsLevel0Words[randomIndex];
        }
      } else {
        // First check for words due for review
        const dueWords = vocabularyWords.filter(word => {
          // Check HSK level 
          if (!hskLevels.includes(word.level)) return false;
          
          // Check if due for review
          const today = new Date().toISOString().split('T')[0];
          return word.nextReview <= today && 
                 Array.isArray(word.examples) && 
                 word.examples.length > 0;
        });
        
        if (dueWords.length > 0) {
          // Pick a random due word
          const randomIndex = Math.floor(Math.random() * dueWords.length);
          word = dueWords[randomIndex];
        } else {
          // No due words, pick a random word from selected HSK levels
          const randomWords = vocabularyWords.filter(word => {
            return hskLevels.includes(word.level) && 
                   Array.isArray(word.examples) && 
                   word.examples.length > 0;
          });
          
          if (randomWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * randomWords.length);
            word = randomWords[randomIndex];
          }
        }
      }
      
      if (word) {
        setCurrentWord(word);
        
        // Get examples for this word
        const examples = getExamplesFromWord(word);
        
        if (examples && examples.length > 0) {
          // Select a random example
          const randomIndex = Math.floor(Math.random() * examples.length);
          setCurrentExample(examples[randomIndex]);
        } else {
          setCurrentExample(null);
        }
        
        return word;
      }
      
      return null;
    } catch (error) {
      console.error("Error selecting word:", error);
      return null;
    }
  }, [vocabularyWords]);
  
  // Update word in vocabulary after practice
  const updateWordAfterPractice = useCallback(async (id, wasCorrect) => {
    try {
      // Update in database
      const updatedWord = await vocabularyDB.updateWordAfterPractice(id, wasCorrect);
      
      // Update in local state
      setVocabularyWords(prev => 
        prev.map(word => word.id === id ? updatedWord : word)
      );
      
      // Update current word if it's the one we modified
      if (currentWord && currentWord.id === id) {
        setCurrentWord(updatedWord);
      }
      
      return updatedWord;
    } catch (error) {
      console.error("Error updating word:", error);
      throw error;
    }
  }, [currentWord]);

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
          <OfflinePracticePage 
            currentWord={currentWord}
            example={currentExample}
            selectNewWord={selectNewWord}
            updateWordAfterPractice={updateWordAfterPractice}
            loading={vocabLoading}
          />
        ) : (
          <PracticePage 
            wsRef={wsRef} 
            offlineMode={offlineMode} 
            wsConnected={wsConnected}
            reconnectWebSocket={reconnectWebSocket}
            currentWord={currentWord}
            currentExample={currentExample}
            selectNewWord={selectNewWord}
            updateWordAfterPractice={updateWordAfterPractice}
            loading={vocabLoading}
          />
        );
      case 'vocabulary':
        return <VocabularyPage 
          words={vocabularyWords}
          loading={vocabLoading}
          onUpdateWord={(updatedWord) => {
            setVocabularyWords(prev => 
              prev.map(word => word.id === updatedWord.id ? updatedWord : word)
            );
          }}
        />;
      case 'progress':
        return <ProgressPage 
          words={vocabularyWords}
          loading={vocabLoading}
        />;
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