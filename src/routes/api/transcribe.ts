import { createFileRoute } from "@tanstack/react-router";

/**
 * Speech-to-text, the way ChatGPT voice does it: the browser records a short
 * utterance and posts the audio here; a hosted model transcribes it server-side.
 */
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return Response.json({ error: "Transcription is not configured." }, { status: 500 });
        }

        let file: File | null = null;
        try {
          const form = await request.formData();
          const entry = form.get("file");
          if (entry instanceof File) file = entry;
        } catch {
          file = null;
        }
        if (!file || file.size === 0) {
          return Response.json({ error: "No audio received." }, { status: 400 });
        }
        if (file.size > 14 * 1024 * 1024) {
          return Response.json({ error: "That clip is too long." }, { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("model", "google/gemini-3.5-transcribe");
        upstream.append("file", file, file.name || "speech.webm");

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(`Transcription failed [${response.status}]: ${detail}`);
          const status =
            response.status === 429 || response.status >= 500 ? response.status : 502;
          return Response.json(
            { error: "The speech service is unavailable right now." },
            { status },
          );
        }

        const result = (await response.json()) as { text?: string };
        return Response.json({ text: (result.text ?? "").trim() });
      },
    },
  },
});
