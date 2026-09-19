import { createParser } from "eventsource-parser";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

export function useSpeechRecognition(onFinalTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onFinalTranscript);
  callbackRef.current = onFinalTranscript;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) {
          const text = result[0]?.transcript.trim() ?? "";
          if (text) callbackRef.current(text);
        } else {
          interimText += result[0]?.transcript ?? "";
        }
      }
      setInterim(interimText);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      try {
        recognition.start();
        setListening(true);
      } catch {
        // start() throws if already started; ignore
      }
    }
  }, [listening]);

  // Half-duplex: pause the mic while the agent speaks so it never hears itself
  // (or the user's "mm-hm") and interrupts the question.
  const wasListeningRef = useRef(false);

  const pause = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    wasListeningRef.current = listening;
    if (listening) {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
      setListening(false);
      setInterim("");
    }
  }, [listening]);

  const resume = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !wasListeningRef.current) return;
    wasListeningRef.current = false;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // already started
    }
  }, []);

  return { supported, listening, interim, toggle, pause, resume };
}

function speakWithBrowserVoice(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

let sharedAudioCtx: AudioContext | null = null;
let speakToken = 0;
let activeSources: AudioBufferSourceNode[] = [];
let activeController: AbortController | null = null;

/** Stops anything currently being spoken so two replies never overlap. */
export function stopSpeaking() {
  speakToken += 1;
  activeController?.abort();
  activeController = null;
  for (const source of activeSources) {
    try {
      source.stop();
      source.disconnect();
    } catch {
      // already finished
    }
  }
  activeSources = [];
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/**
 * Speaks with a natural AI voice (streamed from our /api/tts route).
 * Falls back to the browser's built-in voice if the AI voice is unavailable.
 */
export function speak(text: string) {
  if (typeof window === "undefined") return;
  stopSpeaking();
  const token = speakToken;
  const controller = new AbortController();
  activeController = controller;

  void (async () => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`TTS failed: ${res.status}`);
      if (token !== speakToken) return;

      sharedAudioCtx ??= new AudioContext({ sampleRate: 24000 });
      const ctx = sharedAudioCtx;
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});


      let playhead = 0;
      let pending = new Uint8Array(0);

      const playChunk = (incoming: Uint8Array) => {
        if (token !== speakToken) return;
        const bytes = new Uint8Array(pending.length + incoming.length);
        bytes.set(pending);
        bytes.set(incoming, pending.length);
        const usable = bytes.length - (bytes.length % 2);
        pending = bytes.slice(usable);
        if (usable === 0) return;
        const samples = new Int16Array(bytes.buffer, 0, usable / 2);
        const floats = Float32Array.from(samples, (s) => s / 32768);
        const buffer = ctx.createBuffer(1, floats.length, 24000);
        buffer.copyToChannel(floats, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (playhead === 0) {
          playhead = ctx.currentTime + 0.05;
        } else {
          playhead = Math.max(playhead, ctx.currentTime);
        }
        source.start(playhead);
        activeSources.push(source);
        source.onended = () => {
          activeSources = activeSources.filter((s) => s !== source);
        };
        playhead += buffer.duration;
      };

      const parser = createParser({
        onEvent(event) {
          let payload: { type?: string; audio?: string };
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
          if (payload.type !== "speech.audio.delta" || !payload.audio) return;
          const binary = atob(payload.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          playChunk(bytes);
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (token !== speakToken) return;
        parser.feed(value);
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || token !== speakToken) return;
      // AI voice unavailable — fall back to the browser's built-in voice.
      speakWithBrowserVoice(text);
    }
  })();
}
