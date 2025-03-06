import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
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
    selectNewWord([1, 2, 3, 4, 5, 6, 7])
  }, [loadVocabulary]);

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
      
      return updatedWord;
    } catch (error) {
      console.error("Error updating word:", error);
      throw error;
    }
  }, [currentWord]);
  
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
    
    // Functions
    selectNewWord,
    updateWord
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook for components to use the context
export function useApp() {
  return useContext(AppContext);
}