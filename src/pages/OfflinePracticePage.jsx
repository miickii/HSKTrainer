import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, ArrowRight, Eye, Bookmark } from "lucide-react";
import { vocabularyDB } from "../services/db";
import { useApp } from "../context/AppContext";

export default function OfflinePracticePage() {
  const { 
    currentWord, 
    currentExample, 
    selectNewWord, 
    updateWord,
    loading
  } = useApp();

  const [showDetails, setShowDetails] = useState(false);
  const [answerStatus, setAnswerStatus] = useState(null); // "correct", "incorrect", or null
  const [hskLevels, setHskLevels] = useState([1, 2, 3]); // Default HSK levels to practice
  const [showHint, setShowHint] = useState(false);
  const [showOnlySrsLevel0, setShowOnlySrsLevel0] = useState(false);
  
  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to load settings from localStorage
        const appSettings = localStorage.getItem('appSettings');
        if (appSettings) {
          const settings = JSON.parse(appSettings);
          if (settings.hskFocus && Array.isArray(settings.hskFocus)) {
            setHskLevels(settings.hskFocus);
          }
          if (settings.practiceMode) {
            setPracticeMode(settings.practiceMode);
          }
          if (settings.showOnlySrsLevel0 !== undefined) {
            setShowOnlySrsLevel0(settings.showOnlySrsLevel0);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    
    loadSettings();
  }, []);
  
  // Toggle SRS Level 0 mode
  const toggleSrsLevel0 = () => {
    const newValue = !showOnlySrsLevel0;
    setShowOnlySrsLevel0(newValue);
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      settings.showOnlySrsLevel0 = newValue;
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving setting:", error);
    }
  };
  
  // Load a new word to practice
  const loadNewWord = useCallback(async () => {
    setShowDetails(false);
    setAnswerStatus(null);
    setShowHint(false);
    
    await selectNewWord(hskLevels, showOnlySrsLevel0);
  }, [hskLevels, showOnlySrsLevel0, selectNewWord]);
  
  // Handle user answer (self-reported recognition)
  const handleAnswer = async (recognized) => {
    if (!currentWord) return;
    
    try {
      const updatedWord = await vocabularyDB.updateWordAfterPractice(currentWord.id, recognized);
      // Update word using the provided function
      updateWord(currentWord.id, updatedWord);
      
      // Update UI
      setAnswerStatus(recognized ? "correct" : "incorrect");
      setShowDetails(true);
    } catch (error) {
      console.error("Error updating word:", error);
    }
  };
  
  // Handle toggling favorite status
  const handleToggleFavorite = async () => {
    if (!currentWord) return;
    
    try {
      // Get updated word from database
      const updatedWord = await vocabularyDB.toggleFavorite(currentWord.id);
      
      // Update in parent component
      updateWord(currentWord.id, updatedWord);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  return (
    <div className="p-4 flex flex-col items-center space-y-6">
      {/* SRS Level Toggle */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-neutral-800">Word Selection Mode</div>
            <div className="text-sm text-neutral-500">Focus on new vocabulary</div>
          </div>
          <button
            onClick={toggleSrsLevel0}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            style={{ backgroundColor: showOnlySrsLevel0 ? '#ef4444' : '#e5e5e5' }}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                showOnlySrsLevel0 ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <div className="mt-2 text-xs text-neutral-600">
          {showOnlySrsLevel0 
            ? "Only showing new words (SRS level 0)" 
            : "Showing mixed vocabulary based on review schedule"}
        </div>
      </div>
      
      {/* Character Display */}
      {currentWord ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-neutral-100 p-5 flex flex-col items-center">
            <div className="text-center mb-6 w-full">
                <h2 className="text-6xl font-bold mb-4">{currentWord.simplified}</h2>
                
                {currentExample ? (
                <div className="mt-4">
                    <div className="text-xl mt-2 mb-4 bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                        {currentExample.simplified}
                    </div>
                    
                    {answerStatus && (
                    <div className="mt-3 text-neutral-700">
                        <div className="text-sm text-red-500">{currentExample.pinyin}</div>
                        <div className="text-sm italic mt-1">{currentExample.english}</div>
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
              onClick={handleToggleFavorite}
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