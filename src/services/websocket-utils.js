// src/services/websocket-utils.js
// A simplified utility for WebSocket communication

/**
 * Helper utility for WebSocket communication
 */
export const WebSocketUtils = {
    /**
     * Send a message and wait for a specific response type
     * 
     * @param {WebSocket} ws - The WebSocket connection
     * @param {Object} message - The message to send
     * @param {string} expectedResponseType - The expected response type
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<Object>} - The response data
     */
    sendAndWaitForResponse: (ws, message, expectedResponseType, timeoutMs = 10000) => {
      return new Promise((resolve, reject) => {
        if (!ws) {
          reject(new Error("WebSocket connection is not available"));
          return;
        }
        
        if (ws.readyState !== WebSocket.OPEN) {
          reject(new Error(`WebSocket not connected (state: ${ws.readyState})`));
          return;
        }
        
        // Set timeout
        const timeoutId = setTimeout(() => {
          ws.removeEventListener("message", messageHandler);
          reject(new Error(`Response timeout waiting for "${expectedResponseType}"`));
        }, timeoutMs);
        
        // Message handler to listen for the response
        function messageHandler(event) {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === expectedResponseType) {
              clearTimeout(timeoutId);
              ws.removeEventListener("message", messageHandler);
              resolve(data);
            } else if (data.type === "error") {
              clearTimeout(timeoutId);
              ws.removeEventListener("message", messageHandler);
              reject(new Error(data.detail || "Server error"));
            }
          } catch (err) {
            // Not our response or parsing error, keep waiting
            console.log("Received non-JSON message or unrelated WebSocket message", err);
          }
        }
        
        // Add message handler
        ws.addEventListener("message", messageHandler);
        
        // Send the message
        try {
          const jsonMessage = JSON.stringify(message);
          console.log(`Sending WebSocket message (type: ${message.type})`);
          ws.send(jsonMessage);
        } catch (err) {
          clearTimeout(timeoutId);
          ws.removeEventListener("message", messageHandler);
          reject(new Error(`Failed to send WebSocket message: ${err.message}`));
        }
      });
    },
    
    /**
     * Request a new practice sentence
     * 
     * @param {WebSocket} ws - The WebSocket connection
     * @param {Array<number>} hskLevels - HSK levels to include
     * @returns {Promise<Object>} - The sentence data
     */
    getSentence: async (ws, hskLevels = [1, 2, 3]) => {
      const message = {
        type: "get_sample_words",
        hsk_levels: hskLevels,
        count: 1
      };
      
      console.log("Requesting sentence with HSK levels:", hskLevels);
      return WebSocketUtils.sendAndWaitForResponse(ws, message, "sample_sentence");
    },
    
    /**
     * Send audio for transcription
     * 
     * @param {WebSocket} ws - The WebSocket connection
     * @param {Array<number>} audioSamples - Audio samples (float32 array)
     * @param {Array} sampledWords - Optional array of word objects to check pronunciation for
     * @returns {Promise<Object>} - The transcription result
     */
    sendAudio: async (ws, audioSamples, sampledWords = null) => {
        // Validate audio data
        if (!audioSamples || audioSamples.length === 0) {
          throw new Error("No audio samples to send");
        }
        
        // Log audio statistics - useful for debugging
        let min = Infinity, max = -Infinity, sum = 0;
        for (let i = 0; i < audioSamples.length; i++) {
          const sample = audioSamples[i];
          if (sample < min) min = sample;
          if (sample > max) max = sample;
          sum += Math.abs(sample);
        }
        
        const avgAmplitude = sum / audioSamples.length;
        console.log(`Audio stats: ${audioSamples.length} samples, min: ${min.toFixed(3)}, max: ${max.toFixed(3)}, avg: ${avgAmplitude.toFixed(3)}`);
        
        // If audio seems too quiet, warn but still send
        if (avgAmplitude < 0.01) {
          console.warn("Audio appears to be very quiet - may not transcribe well");
        }
        
        // Prepare message with audio data
        const message = {
          type: "upload_audio",
          realtime_input: {
            media_chunks: [
              {
                mime_type: "audio/pcm-float32",
                samples: audioSamples,
              },
            ],
          },
        };
        
        // Add sampled words if provided
        if (sampledWords && Array.isArray(sampledWords)) {
          message.sampled_words = sampledWords;
          console.log(`Including ${sampledWords.length} sampled words with audio`);
        }
        
        console.log(`Sending ${audioSamples.length} audio samples for transcription`);
        return WebSocketUtils.sendAndWaitForResponse(ws, message, "audio_upload_ack", 20000); // Longer timeout for audio
    }
};