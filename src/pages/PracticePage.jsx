import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Volume2, Wifi, WifiOff } from "lucide-react";
import AudioRecorder from "../components/AudioRecorder";
import { WebSocketUtils } from "../services/websocket-utils";

export default function PracticePage({ wsRef, wsConnected, reconnectWebSocket }) {
  const [sentence, setSentence] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [updateResults, setUpdateResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usedWordIds, setUsedWordIds] = useState([]);
  
  // Request a new sentence
  const requestNewSentence = useCallback(async () => {
    setLoading(true);
    setTranscription("");
    setUpdateResults(null);
    setError(null);
    
    try {
      // Check WebSocket connection
      if (!wsConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError("Not connected to server. Please check your connection.");
        setLoading(false);
        return;
      }

      try {
        // Use WebSocketUtils to get a sentence
        const response = await WebSocketUtils.getSentence(wsRef.current, [1, 2, 3]);
        
        // Set the sentence
        setSentence(response.sentence);

        // Save sampled words from the response
        if (response.sampled_words && response.sampled_words.length > 0) {
          console.log("Received sampled words:", response.sampled_words);
          setUsedWordIds(response.sampled_words.map(word => word.id));
        } else {
          console.warn("No sampled words received from server");
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error requesting sentence:", err);
        setError(`Failed to get sentence: ${err.message}`);
        setLoading(false);
      }
    } catch (err) {
      console.error("Error requesting sentence:", err);
      setError(`Failed to get sentence: ${err.message}`);
      setLoading(false);
    }
  }, [wsConnected, wsRef]);
  
  // Handle transcription start
  const handleTranscriptionStart = () => {
    setTranscription("");
    setUpdateResults(null);
  };
  
  // Handle transcription complete
  const handleTranscriptionComplete = async (data) => {
    if (data.transcription) {
      setTranscription(data.transcription);
    }
    
    if (data.update_results) {
      setUpdateResults(data.update_results);
    }
  };
  
  // Load initial sentence
  useEffect(() => {
    requestNewSentence();
  }, [requestNewSentence]);
  
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
      
      {/* Sentence Card */}
      {sentence ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">{sentence.simplified}</h2>
            
            {/* Only show pinyin and translation after attempt */}
            {transcription && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-md text-gray-700 mb-1">Pinyin: {sentence.pinyin}</p>
                <p className="text-md text-gray-700">English: {sentence.english}</p>
              </div>
            )}
          </div>
        </div>
      ) : loading ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 text-center">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-500">Loading sentence...</p>
        </div>
      ) : error ? (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5 text-center">
          <div className="py-4 text-red-500">{error}</div>
          <div className="flex space-x-2 justify-center">
            <button 
              onClick={requestNewSentence}
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
        disabled={!sentence || loading || !wsConnected}
        sampledWords={usedWordIds.length > 0 ? usedWordIds.map(id => ({ id })) : null}
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
      
      {/* Word Results */}
      {updateResults && updateResults.length > 0 && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-5">
          <h3 className="text-lg font-medium mb-3 text-center">Results</h3>
          <ul className="divide-y divide-gray-100">
            {updateResults.map((result, idx) => (
              <li key={idx} className="py-3 flex items-center justify-between">
                <span className="font-medium">{result.word}</span>
                <span 
                  className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    result.correct 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {result.correct ? (
                    <>
                      <CheckCircle size={16} className="mr-1" />
                      Correct
                    </>
                  ) : (
                    <>
                      <XCircle size={16} className="mr-1" />
                      Incorrect
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* New Sentence Button */}
      <button
        onClick={requestNewSentence}
        disabled={loading || !wsConnected}
        className={`fixed right-4 bottom-20 p-4 rounded-full shadow-lg z-10 ${
          loading || !wsConnected
            ? 'bg-gray-400 text-white' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        <RefreshCw size={24} />
      </button>
    </div>
  );
}