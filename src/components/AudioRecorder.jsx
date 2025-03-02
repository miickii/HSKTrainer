import React, { useRef, useEffect, useState } from "react";
import { Mic, XCircle } from "lucide-react";
import { WebSocketUtils } from "../services/websocket-utils";

export default function AudioRecorder({ 
  wsRef, 
  onTranscriptionStart, 
  onTranscriptionComplete,
  disabled = false
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [useHoldToSpeak, setUseHoldToSpeak] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);
  const [sensitivity, setSensitivity] = useState(1.5);
  
  // Refs for audio handling
  const isRecordingRef = useRef(false);
  const micBufferRef = useRef([]);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorNodeRef = useRef(null);
  const sourceRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastAudioLevelRef = useRef(0);
  
  // Load settings from localStorage
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('appSettings');
      if (storedSettings) {
        const settings = JSON.parse(storedSettings);
        if (settings.useHoldToSpeak !== undefined) {
          setUseHoldToSpeak(settings.useHoldToSpeak);
        }
        if (settings.showWaveform !== undefined) {
          setShowWaveform(settings.showWaveform);
        }
        if (settings.sensitivity !== undefined) {
          setSensitivity(settings.sensitivity);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);
  
  // Clean up audio resources
  const cleanupAudio = () => {
    // Stop visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Disconnect audio nodes
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(err => 
          console.error("Error closing AudioContext:", err)
        );
        audioContextRef.current = null;
      }
    };
  }, []);
  
  // Set up key event listeners for space bar
  useEffect(() => {
    if (disabled || !useHoldToSpeak) return;
    
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !isRecordingRef.current && !isSending && !disabled) {
        e.preventDefault(); // Prevent page scroll
        startRecording();
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === "Space" && isRecordingRef.current) {
        e.preventDefault();
        stopRecording();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [useHoldToSpeak, isSending, disabled, isRecording]);
  
  // Start recording
  async function startRecording() {
    if (disabled || isRecording || isSending) return;
    
    try {
      setError(null);
      console.log("Starting audio recording...");
      
      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000 // Fixed sample rate for better compatibility
        });
      }
      
      // Resume context if suspended (needed for iOS Safari)
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      
      // Request microphone access
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log("Microphone access granted, setting up audio pipeline...");
      mediaStreamRef.current = stream;
      
      // Create audio processing pipeline
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      
      // Set up audio worklet for processing
      try {
        if (!audioContextRef.current.audioWorklet) {
          throw new Error("AudioWorklet not supported in this browser");
        }

        const baseUrl = import.meta.env.BASE_URL || '/';
        console.log("Loading audio worklet with base URL:", baseUrl);
        
        // Use the correct path with base URL
        await audioContextRef.current.audioWorklet.addModule(`${baseUrl}mic-processor.js`);
        processorNodeRef.current = new AudioWorkletNode(audioContextRef.current, "mic-processor");
        console.log("Audio worklet loaded successfully");
      } catch (err) {
        console.error("Error loading audio worklet:", err);
        throw new Error(`Audio system error: ${err.message}`);
      }
      
      // Reset buffer
      micBufferRef.current = [];
      
      // Handle audio samples from the processor
      processorNodeRef.current.port.onmessage = (event) => {
        const { type, data } = event.data;
        
        if (type === "samples" && isRecordingRef.current) {
          // Add samples to buffer
          micBufferRef.current.push(...Array.from(data));
          
          // Calculate audio level (RMS)
          const rms = Math.sqrt(
            data.reduce((sum, sample) => sum + sample * sample, 0) / data.length
          );
          
          // Scale and smooth the level
          const scaledLevel = Math.min(1, rms * sensitivity * 7); // Adjust sensitivity
          const smoothedLevel = scaledLevel * 0.3 + lastAudioLevelRef.current * 0.7;
          lastAudioLevelRef.current = smoothedLevel;
          
          setAudioLevel(smoothedLevel);
          
          // Debug log
          if (micBufferRef.current.length % 4000 === 0) {
            console.log(`Recording: ${micBufferRef.current.length} samples captured, level: ${smoothedLevel.toFixed(2)}`);
          }
          
          // Update visualization if enabled
          if (showWaveform && canvasRef.current) {
            drawVisualization(smoothedLevel);
          }
        }
      };
      
      // Connect the audio nodes
      sourceRef.current.connect(processorNodeRef.current);
      console.log("Audio pipeline connected successfully");
      
      // Update UI state - important to set the ref first
      isRecordingRef.current = true;
      setIsRecording(true);
      
      // Call the start handler
      if (onTranscriptionStart) {
        onTranscriptionStart();
      }
      
      // Start visualization loop
      if (showWaveform) {
        drawVisualization(0);
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(`Microphone access failed: ${err.message}. Please check your browser permissions.`);
      cleanupAudio();
    }
  }
  
  // Stop recording
  function stopRecording() {
    if (!isRecordingRef.current) return;
    
    // Set state and ref
    isRecordingRef.current = false;
    setIsRecording(false);
    
    console.log(`Stopping recording. ${micBufferRef.current.length} samples captured.`);
    
    // Send the audio data if we have any
    if (micBufferRef.current.length > 0) {
      sendAudioData();
    } else {
      console.warn("No audio samples captured during recording");
      setError("No audio captured. Please check your microphone settings and try again.");
    }
    
    // Clean up audio resources
    cleanupAudio();
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  }
  
  // Draw audio visualization
  function drawVisualization(level) {
    if (!canvasRef.current || !showWaveform) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background
    ctx.fillStyle = "#f0f9ff";
    ctx.fillRect(0, 0, width, height);
    
    // Draw bars
    const barCount = 20;
    const barWidth = width / barCount - 2;
    
    for (let i = 0; i < barCount; i++) {
      // Randomize heights slightly around the audio level
      const randomOffset = (Math.random() - 0.5) * 0.3;
      const barHeight = Math.max(5, (level + randomOffset) * height * 0.8);
      
      // Position in center
      const x = i * (barWidth + 2) + 1;
      const y = (height - barHeight) / 2;
      
      // Use blue color gradient
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, "#93c5fd");
      gradient.addColorStop(1, "#3b82f6");
      ctx.fillStyle = gradient;
      
      // Draw bar with rounded corners
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, 4);
      } else {
        // Fallback for browsers that don't support roundRect
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
    
    // Continue animation loop if still recording
    if (isRecordingRef.current && showWaveform) {
      animationFrameRef.current = requestAnimationFrame(() => {
        drawVisualization(lastAudioLevelRef.current);
      });
    }
  }
  
  // Send the audio data to the server
  async function sendAudioData() {
    if (micBufferRef.current.length === 0) return;
    
    const audioSamples = [...micBufferRef.current];
    micBufferRef.current = [];
    
    setIsSending(true);
    console.log(`Sending ${audioSamples.length} audio samples for processing...`);
    
    try {
      // Use the WebSocketUtils to send audio data
      const result = await WebSocketUtils.sendAudio(wsRef.current, audioSamples);
      
      // Handle the transcription result
      if (onTranscriptionComplete) {
        onTranscriptionComplete(result);
      }
    } catch (err) {
      console.error("Error sending audio:", err);
      setError(`Failed to process audio: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  }
  
  // Toggle between tap-to-record and hold-to-speak
  const toggleRecordingMode = () => {
    const newValue = !useHoldToSpeak;
    setUseHoldToSpeak(newValue);
    
    // Save to localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
      settings.useHoldToSpeak = newValue;
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving setting:", error);
    }
  };
  
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className={`flex flex-col items-center justify-center p-4 space-y-4 border border-gray-200 rounded-xl shadow-sm transition-colors ${
        isRecording ? "bg-blue-50 border-blue-200" : "bg-white"
      } ${isSending ? "bg-gray-50 border-gray-300" : ""}`}>
        
        {/* Error display */}
        {error && (
          <div className="w-full p-2 bg-red-50 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
        
        {/* Audio Visualization Canvas */}
        {showWaveform && (
          <div className="w-full relative rounded-lg overflow-hidden h-24 bg-white">
            <canvas
              ref={canvasRef}
              width="400"
              height="100"
              className="w-full h-full"
            ></canvas>
            
            {/* Audio level indicator */}
            <div className="absolute top-2 right-2 flex space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    audioLevel > i * 0.2 ? "bg-blue-500" : "bg-gray-300"
                  }`}
                  style={{ 
                    height: `${Math.min(16, 8 + i * 2)}px`,
                    opacity: audioLevel > i * 0.2 ? 1 : 0.5
                  }}
                ></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Status indicator */}
        <div className="text-center">
          {isRecording ? (
            <p className="text-sm text-blue-600 animate-pulse">Recording... {useHoldToSpeak ? "Release to stop" : "Tap to stop"}</p>
          ) : isSending ? (
            <p className="text-sm text-gray-600">Processing audio...</p>
          ) : (
            <p className="text-sm text-gray-500">
              {useHoldToSpeak
                ? "Hold SPACE or press and hold the microphone to record"
                : "Tap the microphone to start recording"}
            </p>
          )}
        </div>
        
        {/* Recording Mode Toggle */}
        <div className="flex items-center text-xs text-gray-500">
          <span className={useHoldToSpeak ? "text-gray-400" : "text-blue-600"}>Tap</span>
          <button
            onClick={toggleRecordingMode}
            className="mx-2 relative inline-flex items-center h-4 rounded-full w-8 transition-colors ease-in-out duration-200 focus:outline-none bg-gray-200"
            disabled={isRecording || isSending}
          >
            <span 
              className={`inline-block w-3 h-3 transform transition ease-in-out duration-200 rounded-full bg-white shadow-md ${
                useHoldToSpeak ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
          <span className={useHoldToSpeak ? "text-blue-600" : "text-gray-400"}>Hold</span>
        </div>
        
        {/* Main recording button */}
        {useHoldToSpeak ? (
          <button
            onTouchStart={!disabled ? startRecording : undefined}
            onTouchEnd={!disabled ? stopRecording : undefined}
            onMouseDown={!disabled ? startRecording : undefined}
            onMouseUp={!disabled ? stopRecording : undefined}
            onMouseLeave={() => !disabled && isRecording && stopRecording()}
            disabled={disabled || isSending}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all ${
              isRecording
                ? "bg-red-500 scale-110"
                : isSending
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ 
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none"
            }}
          >
            {isRecording ? (
              <XCircle size={28} color="white" />
            ) : (
              <Mic size={28} color="white" />
            )}
          </button>
        ) : (
          <button
            onClick={!disabled ? (isRecording ? stopRecording : startRecording) : undefined}
            disabled={disabled || isSending}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all ${
              isRecording
                ? "bg-red-500 scale-110"
                : isSending
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ 
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none"
            }}
          >
            {isRecording ? (
              <XCircle size={28} color="white" />
            ) : (
              <Mic size={28} color="white" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}