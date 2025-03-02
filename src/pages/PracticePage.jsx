import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Volume2, Wifi, WifiOff } from "lucide-react";
import AudioRecorder from "../components/AudioRecorder";
import { WebSocketUtils } from "../services/websocket-utils";
import { vocabularyDB } from "../services/db";

export default function PracticePage({ wsRef, wsConnected, reconnectWebSocket }) {
  const [currentWord, setCurrentWord] = useState(null);
  const [example, setExample] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
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
  
  // Helper to parse examples from word
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
  
  // Request a new word and example
  const requestNewWord = useCallback(async () => {
    setLoading(true);
    setTranscription("");
    setResults(null);
    setError(null);
    
    try {
      // Get words due for review first, prioritizing each level in the user's selection
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
        
        // Get examples for this word
        const examples = getExamplesFromWord(word);
        
        if (examples && examples.length > 0) {
          // Select a random example
          const randomIndex = Math.floor(Math.random() * examples.length);
          setExample(examples[randomIndex]);
        } else {
          setExample(null);
        }
      } else {
        setError("No words available for practice. Please check your database or HSK level settings.");
      }
    } catch (err) {
      console.error("Error requesting word:", err);
      setError(`Failed to get word: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [hskLevels]);
  
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
        
        // Update the word's learning progress
        await vocabularyDB.updateWordAfterPractice(currentWord.id, containsWord);
        
        // Set results for display
        setResults({
          correct: containsWord,
          word: currentWord.simplified
        });
        
        // Automatically load next word after correct answer (after a delay) if needed
        // Uncomment this if you want to auto-advance on correct answers
        /*
        if (containsWord) {
          setTimeout(() => {
            requestNewWord();
          }, 3000);
        }
        */
        
      } catch (err) {
        console.error("Error processing transcription:", err);
        setError("Error evaluating your pronunciation");
      }
    }
  };
  
  // Load initial word
  useEffect(() => {
    requestNewWord();
  }, [requestNewWord]);

  // Function to render the example sentence with highlighted target character
  const renderExampleSentence = () => {
    if (!example || !example.chinese || !currentWord) return null;
    
    return (
      <div className="mt-3 mb-2 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
        <div className="text-base leading-relaxed">
          {example.chinese.split('').map((char, index) => (
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

  return (
    <div className="h-full flex flex-col p-3">
      {/* Connection status indicator - only show when disconnected */}
      {!wsConnected && (
        <div className="text-xs text-red-500 text-center w-full mb-2 flex items-center justify-center">
          <WifiOff size={12} className="inline mr-1" /> Disconnected
        </div>
      )}
      
      {/* Main content area */}
      <div className="flex flex flex-col">
        {/* Always show the character and example when available */}
        {currentWord && !loading ? (
          <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-3">
            <div className="text-center">
              {/* Character and HSK level */}
              <h2 className="text-2xl font-bold mb-1">{example.simplified}</h2>
              
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
        ) : loading ? (
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
          disabled={!currentWord || loading || !wsConnected}
        />
      </div>
      
      {/* Next Character Button */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={requestNewWord}
          disabled={loading}
          className={`px-5 py-2.5 rounded-lg font-medium flex items-center justify-center ${
            loading
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