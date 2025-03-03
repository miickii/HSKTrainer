import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, ArrowRight, Eye, Bookmark } from "lucide-react";
import { vocabularyDB } from "../services/db";

export default function OfflinePracticePage() {
  const [currentWord, setCurrentWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [answerStatus, setAnswerStatus] = useState(null); // "correct", "incorrect", or null
  const [hskLevels, setHskLevels] = useState([1, 2, 3]); // Default HSK levels to practice
  const [example, setExample] = useState("")
  const [showHint, setShowHint] = useState(false);
  
  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to load HSK level focus from localStorage
        const appSettings = localStorage.getItem('appSettings');
        if (appSettings) {
          const settings = JSON.parse(appSettings);
          if (settings.hskFocus && Array.isArray(settings.hskFocus)) {
            setHskLevels(settings.hskFocus);
          }
          if (settings.practiceMode) {
            setPracticeMode(settings.practiceMode);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    
    loadSettings();
  }, []);

  const getExamplesFromWord = (word) => {
    if (!word || !word.examples) return [];
    
    try {
      const examples = JSON.parse(word.examples);
      return Array.isArray(examples) ? examples : [];
    } catch (err) {
      console.error("Error parsing examples:", err);
      return [];
    }
  };
  
  // Load a new word to practice
  const loadNewWord = useCallback(async () => {
    try {
      setLoading(true);
      setShowDetails(false);
      setAnswerStatus(null);
      setShowHint(false);
      
      // Get words due for review first
      let word = null;
      
      // Try to get a word due for review at one of the selected HSK levels
      for (const level of hskLevels) {
        const dueWords = await vocabularyDB.getDueForReview(40, level);
        if (dueWords && dueWords.length > 0) {
            const randomWordIndex = Math.floor(Math.random() * dueWords.length);
            word = dueWords[randomWordIndex];
            break;
        }
      }
      
      // If no word due for review, get a random word
      if (!word) {
        const randomWords = await vocabularyDB.getRandomWords(40, 
          hskLevels.length === 1 ? hskLevels[0] : null, 
          []
        );
        
        if (randomWords && randomWords.length > 0) {
            const randomWordIndex = Math.floor(Math.random() * randomWords.length);
            word = randomWords[randomWordIndex];
        }
      }
      
      if (word) {
        setCurrentWord(word);

        const examples = getExamplesFromWord(word);
        
        if (examples && examples.length > 0) {
          // Select a random example
          const randomIndex = Math.floor(Math.random() * examples.length);
          setExample(examples[randomIndex]);
        } else {
          setExample(null);
        }
      } else {
        // Fallback message if no words are available
        console.error("No words available for practice");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading word:", error);
      setLoading(false);
    }
  }, [hskLevels]);
  
  // Load initial word on mount
  useEffect(() => {
    loadNewWord();
  }, [loadNewWord]);
  
  // Handle user answer (self-reported recognition)
  const handleAnswer = async (recognized) => {
    if (!currentWord) return;
    
    try {
      // Update word in database based on recognition
      await vocabularyDB.updateWordAfterPractice(currentWord.id, recognized);
      
      // Update UI
      setAnswerStatus(recognized ? "correct" : "incorrect");
      
      // Show details
      setShowDetails(true);
      
    } catch (error) {
      console.error("Error updating word:", error);
    }
  };

  return (
    <div className="p-4 flex flex-col items-center space-y-6">
      {/* Character Display */}
      {currentWord ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-100 p-5 flex flex-col items-center">
            <div className="text-center mb-6 w-full">
                <h2 className="text-6xl font-bold mb-4">{currentWord.simplified}</h2>
                
                {example ? (
                <div className="mt-4">
                    <div className="text-xl mt-2 mb-4 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                        {example.simplified}
                    </div>
                    
                    {answerStatus && (
                    <div className="mt-3 text-neutral-700">
                        <div className="text-sm text-red-500">{example.pinyin}</div>
                        <div className="text-sm italic mt-1">{example.english}</div>
                    </div>
                    )}
                </div>
                ) : (
                <div className="text-neutral-500 mt-2">No example sentence available</div>
                )}
            </div>
          
          {/* HSK Level Badge */}
          {currentWord.level && (
            <div className="mb-4">
              <span className="px-2 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                HSK {currentWord.level}
              </span>
            </div>
          )}
          
          {/* Answer Buttons */}
          {!showDetails && !answerStatus && (
            <div className="flex space-x-4 mt-4 w-full">
              <button
                onClick={() => handleAnswer(false)}
                className="flex-1 px-5 py-3 bg-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-300 transition-colors duration-200"
              >
                <XCircle className="inline-block mr-2" size={20} />
                Don't Know
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="flex-1 px-5 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors duration-200"
              >
                <CheckCircle className="inline-block mr-2" size={20} />
                I Know It
              </button>
            </div>
          )}
          
          {/* Favorite Button */}
          {currentWord && (
            <button
              onClick={async () => {
                try {
                  await vocabularyDB.toggleFavorite(currentWord.id);
                  setCurrentWord(prev => ({
                    ...prev,
                    isFavorite: !prev.isFavorite
                  }));
                } catch (error) {
                  console.error("Error toggling favorite:", error);
                }
              }}
              className={`mt-4 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
                currentWord.isFavorite
                  ? "bg-red-100 text-red-600"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              <Bookmark size={16} className="mr-1.5" fill={currentWord.isFavorite ? "currentColor" : "none"} />
              {currentWord.isFavorite ? "Favorited" : "Add to Favorites"}
            </button>
          )}
          
          {/* Show Answer Status */}
          {answerStatus && (
            <div className={`mt-4 text-center px-4 py-2 rounded-lg`}>
                <button
                    onClick={loadNewWord}
                    disabled={loading}
                    className={`p-4 rounded-full shadow-md z-10 ${
                    answerStatus === "correct" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-600"
                    }`}
                >
                    <RefreshCw size={24} />
                </button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-100 p-5 text-center">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
          </div>
          <p className="text-neutral-500">Loading character...</p>
        </div>
      ) : (
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-100 p-5 text-center">
          <div className="py-4 text-red-500">No characters available for the selected HSK levels</div>
          <div className="flex space-x-2 justify-center">
            <button 
              onClick={loadNewWord}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}