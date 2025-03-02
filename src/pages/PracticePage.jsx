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
        
        // Get an example for this word
        try {
          const exampleSentence = await vocabularyDB.getRandomSentenceForWord(word);
          console.log(exampleSentence)
          setExample(exampleSentence);
        } catch (exErr) {
          console.error("Error fetching example:", exErr);
          // Continue even without an example
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
        // Simple check to see if the word is in the transcription
        const containsWord = transcribedText.includes(currentWord.simplified);
        
        // Update the word's learning progress
        await vocabularyDB.updateWordAfterPractice(currentWord.id, containsWord);
        
        // Set results for display
        setResults({
          correct: containsWord,
          word: currentWord.simplified,
          pinyin: currentWord.pinyin,
          meanings: currentWord.meanings
        });
        
        // Automatically load next word after correct answer (after a short delay)
        if (containsWord) {
          setTimeout(() => {
            requestNewWord();
          }, 2000);
        }
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
  
  // Format the example for display
  const formatExample = () => {
    if (!example) return null;
    
    // If it's already an object with the right properties, use it
    if (example.chinese && example.pinyin) {
      return example;
    }
    
    // If it's a string, it's probably the simplified text
    if (typeof example === 'string') {
      return {
        chinese: example,
        pinyin: "", // No pinyin available
        english: "" // No translation available
      };
    }
    
    return null;
  };
  
  const formattedExample = formatExample();
  
  return (
    <div className="p-4 flex flex-col items-center space-y-6">
      {/* Connection status indicator */}
      <div className="text-xs text-gray-500 text-center w-full">
        {wsConnected ? 
          <span className="text-green-500 flex items-center justify-center">
            <Wifi size={12} className="inline mr-1" /> Connected
          </span> : 
          <span className="text-red-500 flex items-center justify-center">
            <WifiOff size={12} className="inline mr-1" /> Disconnected
          </span>
        }
      </div>
      
      {/* Word and Example Card */}
      {currentWord ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5">
          <div className="text-center mb-4">
            <h2 className="text-5xl font-bold mb-2">{currentWord.simplified}</h2>
            <p className="text-lg text-gray-500 mb-1">{currentWord.pinyin}</p>
            <p className="text-md text-gray-700">{currentWord.meanings}</p>
          </div>
          
          {/* Example if available */}
          {formattedExample && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Example:</p>
              <p className="text-lg">{formattedExample.chinese}</p>
              {formattedExample.pinyin && <p className="text-sm text-gray-600 mt-1">{formattedExample.pinyin}</p>}
              {formattedExample.english && <p className="text-sm text-gray-700 italic mt-1">{formattedExample.english}</p>}
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
      ) : error ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 text-center">
          <div className="py-4 text-red-500">{error}</div>
          <div className="flex space-x-2 justify-center">
            <button 
              onClick={requestNewWord}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Try Again
            </button>
            <button 
              onClick={reconnectWebSocket}
              className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-lg"
            >
              Reconnect
            </button>
          </div>
        </div>
      ) : null}
      
      {/* Audio Recorder */}
      <AudioRecorder 
        wsRef={wsRef} 
        onTranscriptionStart={handleTranscriptionStart}
        onTranscriptionComplete={handleTranscriptionComplete}
        disabled={!currentWord || loading || !wsConnected}
      />
      
      {/* Transcription Result */}
      {transcription && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5">
          <div className="text-center mb-2">
            <h3 className="text-lg font-medium">Your Pronunciation</h3>
            <p className="text-lg bg-gray-50 p-3 rounded-lg mt-2">{transcription}</p>
          </div>
        </div>
      )}
      
      {/* Results */}
      {results && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center justify-center mb-3">
            {results.correct ? (
              <div className="flex items-center text-green-600">
                <CheckCircle size={24} className="mr-2" />
                <span className="text-lg font-medium">Correct!</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircle size={24} className="mr-2" />
                <span className="text-lg font-medium">Try Again</span>
              </div>
            )}
          </div>
          
          {!results.correct && (
            <div className="text-center text-sm text-gray-600 mt-2">
              Say the character or a sentence containing the character
            </div>
          )}
          
          {/* Show next button for incorrect attempts */}
          {!results.correct && (
            <button
              onClick={requestNewWord}
              className="w-full mt-4 py-2 bg-blue-500 text-white rounded-lg"
            >
              Next Character
            </button>
          )}
        </div>
      )}
      
      {/* New Character Button */}
      <button
        onClick={requestNewWord}
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