import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Volume2 } from "lucide-react";
import AudioRecorder from "../components/AudioRecorder";
import { WebSocketUtils } from "../services/websocket-utils";
import { vocabularyDB } from "../services/db";
import { useApp } from "../context/AppContext";

export default function PracticePage() {
  // Get context values instead of using props
  const { 
    wsRef, 
    wsConnected, 
    reconnectWebSocket,
    currentWord,
    currentExample: example, // Alias to match your existing code
    selectNewWord,
    updateWord,
    loading: propLoading
  } = useApp();

  const [transcription, setTranscription] = useState("");
  const [results, setResults] = useState(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hskLevels, setHskLevels] = useState([1, 2, 3]);
  
  // Load HSK level settings
  useEffect(() => {
    try {
      const appSettings = localStorage.getItem('appSettings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        if (settings.hskFocus && Array.isArray(settings.hskFocus)) {
          setHskLevels(settings.hskFocus);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);
  
  // Request a new word and example using context function
  const requestNewWord = useCallback(async () => {
    setLocalLoading(true);
    setTranscription("");
    setResults(null);
    setError(null);
    
    try {
      const word = await selectNewWord(hskLevels, false);
      
      if (!word) {
        setError("No words available for practice. Please check your database or HSK level settings.");
      }
    } catch (err) {
      console.error("Error requesting word:", err);
      setError(`Failed to get word: ${err.message}`);
    } finally {
      setLocalLoading(false);
    }
  }, [hskLevels, selectNewWord]);
  
  // Handle transcription start
  const handleTranscriptionStart = () => {
    setTranscription("");
    setResults(null);
  };
  
  // Handle transcription complete
  const handleTranscriptionComplete = async (data) => {
    if (!data || !data.transcription) {
      setError("No transcription received");
      return;
    }
    
    const transcribedText = data.transcription;
    setTranscription(transcribedText);
    
    // Now evaluate transcription against the current word
    if (currentWord && currentWord.simplified) {
      try {
        // Check if the word is in the transcription
        const containsWord = transcribedText.includes(currentWord.simplified);
        const updatedWord = await vocabularyDB.updateWordAfterPractice(currentWord.id, containsWord);
        
        // Update the word's learning progress
        updateWord(currentWord.id, updatedWord);
        
        // Set results for display
        setResults({
          correct: containsWord,
          word: currentWord.simplified
        });
      } catch (err) {
        console.error("Error processing transcription:", err);
        setError("Error evaluating your pronunciation");
      }
    }
  };

  // Function to render the example sentence with highlighted target character
  const renderExampleSentence = () => {
    if (!example || !example.simplified || !currentWord) return null;
    
    return (
      <div className="mt-3 mb-2 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
        <div className="text-base leading-relaxed">
          {example.simplified.split('').map((char, index) => (
            <span 
              key={index}
              className={char === currentWord.simplified ? 
                "text-red-600 font-bold" : ""}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Determine if the component is loading
  const isLoading = propLoading || localLoading;

  return (
    <div className="h-full flex flex-col p-3">
      {/* Main content area */}
      <div className="flex flex flex-col">
        {/* Always show the character and example when available */}
        {currentWord && !isLoading ? (
          <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-3">
            <div className="text-center">
              {/* Character and HSK level */}
              <h2 className="text-2xl font-bold mb-1">{currentWord.simplified}</h2>

              {transcription && (
                <div>
                  <h2 className="text-xl mb-1">{currentWord.pinyin}</h2>
                  <h2 className="text-xl mb-1">{currentWord.english}</h2>
                </div>
              )}
              
              {currentWord.level && (
                <div className="mb-2">
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">
                    HSK {currentWord.level}
                  </span>
                </div>
              )}
              
              {/* Example sentence */}
              {renderExampleSentence()}
            </div>
          </div>
        ) : isLoading ? (
          <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 text-center mb-3">
            <div className="flex justify-center items-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
            </div>
            <p className="text-neutral-500">Loading character...</p>
          </div>
        ) : error ? (
          <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 text-center mb-3">
            <div className="py-4 text-red-500">{error}</div>
            <div className="flex space-x-2 justify-center">
              <button 
                onClick={requestNewWord}
                className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium"
              >
                Try Again
              </button>
              <button 
                onClick={reconnectWebSocket}
                className="mt-2 px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg font-medium"
              >
                Reconnect
              </button>
            </div>
          </div>
        ) : null}
        
        {/* Transcription results section */}
        {transcription && (
          <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-3">
            <div className="text-center">
              <h3 className="text-lg font-medium text-neutral-800 mb-2">Your Pronunciation</h3>
              <p className="text-base bg-neutral-50 p-3 rounded-lg border border-neutral-100">{transcription}</p>
              
              {/* Show results when available */}
              {results && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="flex items-center justify-center mb-2">
                    {results.correct ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle size={20} className="mr-2" />
                        <span className="text-base font-medium">Correct!</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-500">
                        <XCircle size={20} className="mr-2" />
                        <span className="text-base font-medium">Try Again</span>
                      </div>
                    )}
                  </div>
                  
                  {!results.correct && (
                    <p className="text-sm text-neutral-600 mt-1">
                      Try to include the character in your sentence
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Audio Recorder */}
      <div className="">
        <AudioRecorder 
          wsRef={wsRef} 
          onTranscriptionStart={handleTranscriptionStart}
          onTranscriptionComplete={handleTranscriptionComplete}
          disabled={!currentWord || isLoading || !wsConnected}
        />
      </div>
      
      {/* Next Character Button */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={requestNewWord}
          disabled={isLoading}
          className={`px-5 py-2.5 rounded-lg font-medium flex items-center justify-center ${
            isLoading
              ? 'bg-neutral-300 text-white' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          <RefreshCw size={18} className="mr-2" />
          New Character
        </button>
      </div>
    </div>
  );
}