import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceStatus = "off" | "listening" | "thinking" | "speaking";

/** Volume above which we consider the user to be speaking. */
const SPEECH_RMS = 0.02;
/** Silence after speech that ends the turn (ms) — same feel as ChatGPT voice. */
const END_OF_TURN_MS = 1100;
/** Ignore blips shorter than this so a cough isn't a turn (ms). */
const MIN_SPEECH_MS = 300;

interface Options {
  /** Called with the transcript of each completed turn. */
  onUtterance: (text: string) => void;
}

/**
 * ChatGPT-style voice turn-taking:
 * continuous mic capture → energy-based voice activity detection → on end of
 * speech the clip is sent to the server for transcription → the transcript is
 * handed back. The mic is muted while the agent talks so it never hears itself.
 */
export function useVoiceSession({ onUtterance }: Options) {
  const [status, setStatus] = useState<VoiceStatus>("off");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const mutedRef = useRef(false);
  const activeRef = useRef(false);
  const speechMsRef = useRef(0);
  const silenceMsRef = useRef(0);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  const transcribe = useCallback(async (blob: Blob) => {
    const form = new FormData();
    form.append("file", blob, "speech.webm");
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      const text = (data.text ?? "").trim();
      if (text) onUtteranceRef.current(text);
      else if (activeRef.current) setStatus("listening");
    } catch (err) {
      console.error(err);
      setError("I couldn't hear that clearly — please try again.");
      if (activeRef.current) setStatus("listening");
    }
  }, []);

  /** Restart the recorder so every clip is a complete, valid file. */
  const cycleRecorder = useCallback(
    (keep: boolean) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") return;
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (keep && blob.size > 2000) {
          setStatus("thinking");
          void transcribe(blob);
        }
        if (activeRef.current && streamRef.current) {
          try {
            recorder.start(250);
          } catch {
            /* recorder already restarted */
          }
        }
      };
      recorder.stop();
    },
    [transcribe],
  );

  const stop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
    setStatus("off");
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      activeRef.current = true;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start(250);
      setStatus("listening");

      let last = performance.now();
      const tick = () => {
        if (!activeRef.current) return;
        const now = performance.now();
        const delta = now - last;
        last = now;

        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        const rms = Math.sqrt(sum / buffer.length);
        setLevel(rms);

        if (!mutedRef.current) {
          if (rms > SPEECH_RMS) {
            speechMsRef.current += delta;
            silenceMsRef.current = 0;
          } else if (speechMsRef.current > 0) {
            silenceMsRef.current += delta;
            if (silenceMsRef.current >= END_OF_TURN_MS) {
              const heard = speechMsRef.current >= MIN_SPEECH_MS;
              speechMsRef.current = 0;
              silenceMsRef.current = 0;
              cycleRecorder(heard);
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      setError("I need permission to use your microphone.");
      setStatus("off");
    }
  }, [cycleRecorder]);

  /** Mute while the agent talks, then drop whatever was captured meanwhile. */
  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    speechMsRef.current = 0;
    silenceMsRef.current = 0;
    if (!activeRef.current) return;
    setStatus(muted ? "speaking" : "listening");
  }, []);

  const setThinking = useCallback((thinking: boolean) => {
    if (!activeRef.current) return;
    setStatus(thinking ? "thinking" : "listening");
  }, []);

  useEffect(() => stop, [stop]);

  return { status, level, error, active: activeRef.current, start, stop, setMuted, setThinking };
}
