import React, { useState, useEffect } from "react";
import { ChevronLeft, Heart, Volume2, ExternalLink, X } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { vocabularyDB } from "../services/db";
import { useApp } from "../context/AppContext";

/**
 * WordDetailView - A reusable component to display detailed information about a word
 * 
 * @param {Object} props Component props
 * @param {Object} props.word The word object to display (if not provided, will use detailViewWord from context)
 * @param {string} props.mode 'modal' | 'embedded' | 'fullscreen' - Display mode
 * @param {string} props.sourceScreen The screen to return to when closing
 * @param {function} props.onClose Optional callback for when view is closed
 * @param {boolean} props.showBackButton Whether to show the back button
 */
export default function WordDetailView({ 
  word: propWord = null,
  mode = 'fullscreen',
  sourceScreen = 'vocabulary',
  onClose = null,
  showBackButton = true
}) {
  const { 
    detailViewWord: contextWord,
    closeWordDetail,
    updateWord
  } = useApp();
  
  // Use provided word or word from context
  const word = propWord || contextWord;
  
  useEffect(() => {
    // If no word is available, close the view
    if (!word) {
      handleClose();
    }
  }, [word]);
  
  // Handle closing the detail view
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeWordDetail();
    }
  };
  
  // Format a date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    
    return new Date(dateStr).toLocaleDateString();
  };
  
  // Toggle favorite status
  const toggleFavorite = async () => {
    if (!word) return;
    
    try {
      const updatedWord = await vocabularyDB.toggleFavorite(word.id);
      updateWord(word.id, updatedWord);
    } catch (error) {
      console.error("Error toggling favorite status:", error);
    }
  };

  // If no word is available, return null
  if (!word) return null;
  
  // Render appropriate layout based on mode
  const renderContent = () => (
    <>
      {/* Header with character, pinyin, and meaning */}
      <div className="text-center mb-6">
        <div className="text-5xl font-bold mb-2">{word.simplified}</div>
        <div className="text-xl text-red-500 mb-1">{word.pinyin}</div>
        <div className="text-lg text-neutral-700">{word.meanings || word.english}</div>
        
        {/* HSK Level Badge and other top-level info */}
        <div className="flex items-center justify-center mt-3 space-x-2">
          <span className="px-2 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
            HSK {word.level}
          </span>
          
          {word.correctCount > 0 ? (
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
              Mastered
            </span>
          ) : (
            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
              Learning
            </span>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-center space-x-4 mb-6">
        <button 
          onClick={toggleFavorite}
          className={`p-3 rounded-full ${
            word.isFavorite
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
          }`}
        >
          <Heart size={20} fill={word.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      
      {/* SRS & Statistics */}
      <div className="bg-neutral-50 rounded-xl p-4 mb-6">
        <h3 className="text-lg font-medium text-neutral-800 mb-3">Learning Progress</h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-sm text-neutral-500">Correct</div>
            <div className="text-xl font-medium text-neutral-800">{word.correctCount || 0}</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-neutral-500">Incorrect</div>
            <div className="text-xl font-medium text-neutral-800">{word.incorrectCount || 0}</div>
          </div>
          
          <div className="text-center">
            <div className="text-sm text-neutral-500">SRS Level</div>
            <div className="text-xl font-medium text-neutral-800">{word.srsLevel || 0}</div>
          </div>
        </div>
        
        {word.nextReview && (
          <div className="text-center text-sm text-neutral-600">
            Next review: <span className="font-medium">{formatDate(word.nextReview)}</span>
          </div>
        )}
      </div>
      
      {/* Character details */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4 mb-6">
        <h3 className="text-lg font-medium text-neutral-800 mb-3">Character Details</h3>
        
        <div className="space-y-2">
          {word.traditional && word.traditional !== word.simplified && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Traditional:</span>
              <span className="font-medium">{word.traditional}</span>
            </div>
          )}
          
          {word.radical && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Radical:</span>
              <span className="font-medium">{word.radical}</span>
            </div>
          )}
          
          {/* Add stroke count, character components, etc. if available */}
        </div>
      </div>
      
      {/* Example sentences */}
      <div className="bg-white rounded-xl border border-neutral-100 p-4 mb-6">
        <h3 className="text-lg font-medium text-neutral-800 mb-3">Example Sentences</h3>
        
        {word.examples && word.examples.length > 0 ? (
          <div className="space-y-4">
            {word.examples.map((example, index) => (
              <div 
                key={uuidv4()}
                className={`pb-4 ${index < word.examples.length - 1 ? "border-b border-neutral-100" : ""}`}
              >
                <div className="text-lg mb-2">
                  {example.simplified}
                </div>
                <div className="text-sm text-red-500 mb-1">{example.pinyin}</div>
                <div className="text-sm text-neutral-700">{example.english}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-neutral-500 py-4">
            No example sentences available
          </div>
        )}
      </div>
    </>
  );
  
  // Render based on mode
  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white p-4 border-b border-neutral-100 flex justify-between items-center">
            {showBackButton ? (
              <button onClick={handleClose} className="p-1 text-neutral-500">
                <ChevronLeft size={24} />
              </button>
            ) : (
              <div></div> // Empty div for spacing
            )}
            
            <h2 className="text-lg font-bold text-neutral-900">Word Details</h2>
            
            <button onClick={handleClose} className="p-1 text-neutral-500">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-4">
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }
  
  if (mode === 'embedded') {
    return (
      <div className="bg-white rounded-xl border border-neutral-100 p-4 mb-4">
        {renderContent()}
      </div>
    );
  }
  
  // Default: fullscreen
  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-white p-4 border-b border-neutral-100 flex justify-between items-center safe-top safe-left safe-right z-10">
        {showBackButton ? (
          <button onClick={handleClose} className="p-1 text-neutral-500">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div></div> // Empty div for spacing
        )}
        
        <h2 className="text-lg font-bold text-neutral-900">Word Details</h2>
        
        <div className="w-8"></div> {/* Spacer for centering title */}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-16 safe-left safe-right">
        {renderContent()}
      </div>
    </div>
  );
}