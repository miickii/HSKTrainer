import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { vocabularyDB } from '../services/db';
import { useWebSocket } from '../hooks/useWebSocket';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Get settings from localStorage
  const [preferOfflinePractice, setPreferOfflinePractice] = useState(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      return settings.preferOfflinePractice || false;
    } catch (error) {
      return false;
    }
  });

  // Use the WebSocket hook
  const { wsRef, status, connected: wsConnected, offlineMode, reconnect: reconnectWebSocket } = 
    useWebSocket(preferOfflinePractice);

  // Vocabulary state
  const [vocabularyWords, setVocabularyWords] = useState([]);
  const [currentWord, setCurrentWord] = useState(null);
  const [currentExample, setCurrentExample] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Filtered vocabulary state
  const [filteredVocabulary, setFilteredVocabulary] = useState([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [filterType, setFilterType] = useState("all"); // all, mastered, learning, favorite
  
  // Word detail view state
  const [detailViewActive, setDetailViewActive] = useState(false);
  const [detailViewWord, setDetailViewWord] = useState(null);
  const [navigationStack, setNavigationStack] = useState([]);
  const [selectedWordId, setSelectedWordId] = useState(null);
  
  // Load vocabulary from database
  const loadVocabulary = useCallback(async () => {
    try {
      // Only load if not already loaded
      if (vocabularyWords.length === 0) {
        setLoading(true);
        
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
          setFilteredVocabulary(data); // Initialize filtered results with all words
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading vocabulary:", error);
      setLoading(false);
    }
  }, [vocabularyWords.length]);
  
  // Add this effect to load vocabulary when app starts
  useEffect(() => {
    loadVocabulary();
  }, [loadVocabulary]);

  // Filter vocabulary based on search and filters
  useEffect(() => {
    if (vocabularyWords.length === 0) return;
    
    setIsFiltering(true);
    
    const timeoutId = setTimeout(() => {
      const results = vocabularyWords.filter(word => {
        let matches = true;
        
        if (selectedLevel !== null) {
          matches = matches && word.level === selectedLevel;
        } else {
            matches = matches && word.level !== -1;
        }
        
        if (filterType === "mastered") {
          matches = matches && (word.correctCount > 0);
        } else if (filterType === "learning") {
          matches = matches && (word.correctCount === 0);
        } else if (filterType === "favorite") {
          matches = matches && word.isFavorite;
        }
        
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          matches = matches && (
            word.simplified.includes(searchTerm) ||
            word.pinyin?.toLowerCase().includes(searchLower) ||
            word.meanings?.toLowerCase().includes(searchLower) ||
            word.english?.toLowerCase().includes(searchLower)
          );
        }
        
        return matches;
      });
      
      setFilteredVocabulary(results);
      setIsFiltering(false);
    }, 10);
    
    return () => clearTimeout(timeoutId);
  }, [vocabularyWords, searchTerm, selectedLevel, filterType]);

  const getExamplesFromWord = (word) => {
    if (!word || !word.examples) return [];
    return word.examples;
  };
  
  // Function to select a new word for practice
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
  }, [vocabularyWords, loadVocabulary]);

  // Update a word in both the vocabulary list and current word if needed
  const updateWord = useCallback(async (id, updatedWord) => {
    try {
      try {
        updatedWord.examples = JSON.parse(updatedWord.examples || '[]');
      } catch (e) {
        updatedWord.examples = [];
        console.error("Error parsing examples for word:", updatedWord.id);
      }
      // Update in local state
      setVocabularyWords(prev => 
        prev.map(word => word.id === id ? updatedWord : word)
      );
      
      // Update current word if it's the one we modified
      if (currentWord && currentWord.id === id) {
        setCurrentWord(updatedWord);
      }
      
      // Update detail view word if it's the one we modified
      if (detailViewWord && detailViewWord.id === id) {
        setDetailViewWord(updatedWord);
      }
      
      return updatedWord;
    } catch (error) {
      console.error("Error updating word:", error);
      throw error;
    }
  }, [currentWord, detailViewWord]);
  
  // Function to open word detail view
  const openWordDetail = useCallback((word, sourceScreen) => {
    // Save current navigation state
    setNavigationStack(prev => [...prev, { screen: sourceScreen }]);
    setDetailViewWord(word);
    setDetailViewActive(true);
    setSelectedWordId(word.id);
  }, []);
  
  // Function to close word detail view and return to previous screen
  const closeWordDetail = useCallback(() => {
    // Get the last navigation item and remove it from the stack
    const newStack = [...navigationStack];
    const lastScreen = newStack.pop();
    
    setNavigationStack(newStack);
    setDetailViewActive(false);
    setDetailViewWord(null);
    
    return lastScreen?.screen || 'vocabulary'; // Default to vocabulary if no previous screen
  }, [navigationStack]);
  
  // Function to find a word by ID
  const findWordById = useCallback((id) => {
    return vocabularyWords.find(word => word.id === id);
  }, [vocabularyWords]);
  
  // Function to toggle expanded state for a word in vocabulary list
  const toggleWordExpanded = useCallback((id) => {
    if (selectedWordId === id) {
      setSelectedWordId(null);
    } else {
      setSelectedWordId(id);
    }
  }, [selectedWordId]);
  
  const value = {
    // WebSocket state from hook
    wsRef,
    wsConnected,
    status,
    offlineMode,
    reconnectWebSocket,
    preferOfflinePractice,
    setPreferOfflinePractice,
    
    // Vocabulary state
    vocabularyWords,
    currentWord,
    currentExample,
    loading,
    
    // Filtered vocabulary state
    filteredVocabulary,
    isFiltering,
    searchTerm,
    setSearchTerm,
    selectedLevel,
    setSelectedLevel,
    filterType,
    setFilterType,
    
    // Word detail view state
    detailViewActive,
    detailViewWord,
    selectedWordId,
    
    // Functions
    selectNewWord,
    updateWord,
    openWordDetail,
    closeWordDetail,
    findWordById,
    toggleWordExpanded
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook for components to use the context
export function useApp() {
  return useContext(AppContext);
}