import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, ArrowRight, Eye, Bookmark } from "lucide-react";
import { vocabularyDB } from "../services/db";

export default function OfflinePracticePage() {
  const [currentWord, setCurrentWord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [answerStatus, setAnswerStatus] = useState(null); // "correct", "incorrect", or null
  const [hskLevels, setHskLevels] = useState([1, 2, 3]); // Default HSK levels to practice
  const [practiceMode, setPracticeMode] = useState("recognition"); // recognition, context, writing
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
        const dueWords = await vocabularyDB.getDueForReview(1, level);
        if (dueWords && dueWords.length > 0) {
          word = dueWords[0];
          break;
        }
      }
      
      // If no word due for review, get a random word
      if (!word) {
        const randomWords = await vocabularyDB.getRandomWords(1, 
          hskLevels.length === 1 ? hskLevels[0] : null, 
          []
        );
        
        if (randomWords && randomWords.length > 0) {
          word = randomWords[0];
        }
      }
      
      if (word) {
        setCurrentWord(word);
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
      
      // Automatically load next word after delay if answered correctly
      if (recognized) {
        setTimeout(() => {
          loadNewWord();
        }, 1500);
      }
    } catch (error) {
      console.error("Error updating word:", error);
    }
  };
  
  // Toggle practice mode
  const togglePracticeMode = () => {
    // Rotate through practice modes
    const modes = ["recognition", "context", "writing"];
    const currentIndex = modes.indexOf(practiceMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setPracticeMode(nextMode);
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      settings.practiceMode = nextMode;
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving practice mode:", error);
    }
    
    // Reset the current practice
    loadNewWord();
  };
  
  // Get example sentence from word
  const getExampleSentence = useCallback(() => {
    if (!currentWord || !currentWord.examples) return null;
    
    try {
      const examples = JSON.parse(currentWord.examples);
      if (Array.isArray(examples) && examples.length > 0) {
        // Get a random example
        const randomIndex = Math.floor(Math.random() * examples.length);
        return examples[randomIndex];
      }
    } catch (error) {
      console.error("Error parsing examples:", error);
    }
    
    return null;
  }, [currentWord]);
  
  // Function to split a sentence and highlight the target character
  const renderSentenceWithHighlight = (sentence, targetChar) => {
    if (!sentence || !sentence.simplified) return null;
    
    const parts = sentence.simplified.split('');
    
    return (
      <div className="text-xl mt-2 mb-4">
        {parts.map((char, index) => (
          <span 
            key={index}
            className={char === targetChar ? 
              "text-blue-600 font-bold border-b-2 border-blue-400" : ""}
          >
            {char}
          </span>
        ))}
      </div>
    );
  };
  
  // Render the appropriate practice content based on mode
  const renderPracticeContent = () => {
    if (!currentWord) return null;
    
    switch (practiceMode) {
      case "recognition":
        // Simple character recognition
        return (
          <div className="text-center mb-4">
            <h2 className="text-5xl font-bold mb-4">{currentWord.simplified}</h2>
            
            {currentWord.traditional && currentWord.traditional !== currentWord.simplified && (
              <div className="text-gray-500 text-lg mb-2">
                Traditional: {currentWord.traditional}
              </div>
            )}
          </div>
        );
        
      case "context":
        // Show character in context of a sentence
        const exampleSentence = getExampleSentence();
        return (
          <div className="text-center mb-4">
            <h2 className="text-5xl font-bold mb-2">{currentWord.simplified}</h2>
            
            {exampleSentence ? (
              <div className="mt-4">
                {renderSentenceWithHighlight(exampleSentence, currentWord.simplified)}
                
                {showHint && (
                  <div className="mt-2 text-gray-700">
                    <div className="text-sm">{exampleSentence.pinyin}</div>
                    <div className="text-sm italic mt-1">{exampleSentence.english}</div>
                  </div>
                )}
                
                {!showHint && (
                  <button 
                    onClick={() => setShowHint(true)}
                    className="mt-2 text-sm text-blue-500"
                  >
                    Show pinyin and translation
                  </button>
                )}
              </div>
            ) : (
              <div className="text-gray-500 mt-2">No example sentence available</div>
            )}
          </div>
        );
        
      case "writing":
        // Practice writing/remembering the character
        return (
          <div className="text-center mb-4">
            <div className="text-xl mb-4">
              <span className="font-medium">Pinyin:</span> {currentWord.pinyin}
            </div>
            <div className="text-lg mb-4">
              <span className="font-medium">Meaning:</span> {currentWord.meanings}
            </div>
            
            {showHint && (
              <div className="mt-4 text-4xl font-bold text-blue-600">
                {currentWord.simplified}
              </div>
            )}
            
            {!showHint && (
              <button 
                onClick={() => setShowHint(true)}
                className="mt-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg"
              >
                Show Character
              </button>
            )}
          </div>
        );
        
      default:
        return (
          <div className="text-center mb-4">
            <h2 className="text-5xl font-bold mb-4">{currentWord.simplified}</h2>
          </div>
        );
    }
  };

  return (
    <div className="p-4 flex flex-col items-center space-y-6">
      <div className="text-xs text-gray-500 text-center w-full">
        Offline Practice Mode: Character {practiceMode.charAt(0).toUpperCase() + practiceMode.slice(1)}
      </div>
      
      {/* Practice Mode Selector */}
      <div className="flex overflow-x-auto space-x-2 py-1 -mx-4 px-4 w-full">
        <button
          onClick={() => {
            setPracticeMode("recognition");
            loadNewWord();
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
            practiceMode === "recognition"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          Recognition
        </button>
        
        <button
          onClick={() => {
            setPracticeMode("context");
            loadNewWord();
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
            practiceMode === "context"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          In Context
        </button>
        
        <button
          onClick={() => {
            setPracticeMode("writing");
            loadNewWord();
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
            practiceMode === "writing"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          Writing Practice
        </button>
      </div>
      
      {/* Character Display */}
      {currentWord ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 flex flex-col items-center">
          {renderPracticeContent()}
          
          {/* HSK Level Badge */}
          {currentWord.level && (
            <div className="mb-3">
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                HSK {currentWord.level}
              </span>
            </div>
          )}
          
          {/* Answer Buttons */}
          {!showDetails && !answerStatus && (
            <div className="flex space-x-4 mt-4">
              <button
                onClick={() => handleAnswer(false)}
                className="px-5 py-3 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition-colors duration-200"
              >
                <XCircle className="inline-block mr-2" size={20} />
                Don't Know
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="px-5 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 transition-colors duration-200"
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
                  // Update the current word object
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
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              <Bookmark size={16} className="mr-1.5" fill={currentWord.isFavorite ? "currentColor" : "none"} />
              {currentWord.isFavorite ? "Favorited" : "Add to Favorites"}
            </button>
          )}
          
          {/* Show Answer Status */}
          {answerStatus && (
            <div className={`mt-4 text-center px-4 py-2 rounded-lg ${
              answerStatus === "correct" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}>
              {answerStatus === "correct" ? (
                <span className="flex items-center justify-center">
                  <CheckCircle size={20} className="mr-2" />
                  Correct!
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <XCircle size={20} className="mr-2" />
                  Practice more
                </span>
              )}
            </div>
          )}
          
          {/* Details Section (shown after answering) */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-gray-100 w-full">
              <p className="text-md text-gray-700 mb-2">Pinyin: <span className="font-medium">{currentWord.pinyin}</span></p>
              <p className="text-md text-gray-700 mb-2">Meaning: <span className="font-medium">{currentWord.meanings}</span></p>
              
              {/* Progress Information */}
              <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">Practiced correctly:</span>
                  <span className="text-sm font-medium">{currentWord.correctCount || 0} times</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">SRS Level:</span>
                  <span className="text-sm font-medium">{currentWord.srsLevel || 0}</span>
                </div>
              </div>
              
              {/* Next Button if incorrect */}
              {answerStatus === "incorrect" && (
                <button
                  onClick={loadNewWord}
                  className="w-full mt-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors duration-200"
                >
                  <ArrowRight className="inline-block mr-2" size={18} />
                  Next Character
                </button>
              )}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 text-center">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-500">Loading character...</p>
        </div>
      ) : (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 text-center">
          <div className="py-4 text-red-500">No characters available for the selected HSK levels</div>
          <div className="flex space-x-2 justify-center">
            <button 
              onClick={loadNewWord}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      
      {/* Toggle Details Button */}
      {currentWord && !showDetails && (
        <button
          onClick={() => setShowDetails(true)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg flex items-center"
        >
          <Eye size={18} className="mr-2" />
          Show Details
        </button>
      )}
      
      {/* Refresh Button */}
      <button
        onClick={loadNewWord}
        disabled={loading}
        className={`fixed right-4 bottom-20 p-4 rounded-full shadow-lg z-10 ${
          loading
            ? 'bg-gray-400 text-white' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        <RefreshCw size={24} />
      </button>
    </div>
  );
}