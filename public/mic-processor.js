class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleCount = 0;
    this.debugCounter = 0;
  }
  
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      // Get the raw float samples in the range [-1, 1]
      const samples = input[0];
      
      // Send the raw samples to the main thread
      this.port.postMessage({ 
        type: "samples", 
        data: samples 
      });
      
      // Update sample count
      this.sampleCount += samples.length;
      this.debugCounter++;
      
      // Log every ~1 second (assuming typical 128 sample buffers at 44.1kHz)
      if (this.debugCounter >= 300) {
        // This log is in the worklet context and won't appear in the main console
        console.log(`AudioWorklet: Processed ${this.sampleCount} samples`);
        this.debugCounter = 0;
      }
    }
    
    // Return true to keep the processor running
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);