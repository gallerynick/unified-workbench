import { useEffect, useRef, useState, useCallback } from 'react';

export interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  error: string | null;
}

export interface AudioCaptureOptions {
  onAudioChunk?: (data: ArrayBuffer, duration: number) => void;
  sampleRate?: number;
}

export function useAudioCapture(options: AudioCaptureOptions = {}) {
  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    error: null,
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const [onAudioChunk, setOnAudioChunk] = useState(options.onAudioChunk);
  const sampleRate = options.sampleRate || 16000;

  useEffect(() => {
    setOnAudioChunk(options.onAudioChunk);
  }, [options.onAudioChunk]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: sampleRate });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for audio processing
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to Int16
        const int16Array = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Calculate duration
        const duration = Date.now() - startTimeRef.current - pausedTimeRef.current;
        
        // Send audio chunk
        if (onAudioChunk) {
          onAudioChunk(int16Array.buffer, duration / 1000);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;

      setState({
        isRecording: true,
        isPaused: false,
        durationSeconds: 0,
        error: null,
      });
    } catch (error) {
      console.error('Audio capture error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start audio capture',
      }));
    }
  }, [onAudioChunk, sampleRate]);

  const pause = useCallback(() => {
    if (!audioContextRef.current || !state.isRecording || state.isPaused) return;
    
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    setState((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, [state.isRecording, state.isPaused]);

  const resume = useCallback(() => {
    if (!audioContextRef.current || !state.isPaused) return;
    
    pausedTimeRef.current += Date.now() - startTimeRef.current;
    startTimeRef.current = Date.now();
    setState((prev) => ({
      ...prev,
      isPaused: false,
    }));
  }, [state.isPaused]);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    const duration = Date.now() - startTimeRef.current - pausedTimeRef.current;
    setState({
      isRecording: false,
      isPaused: false,
      durationSeconds: duration / 1000,
      error: null,
    });
  }, []);

  // Update duration periodically
  useEffect(() => {
    if (!state.isRecording || state.isPaused) return;
    
    const interval = setInterval(() => {
      const duration = Date.now() - startTimeRef.current - pausedTimeRef.current;
      setState((prev) => ({
        ...prev,
        durationSeconds: duration / 1000,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRecording, state.isPaused]);

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
  };
}
