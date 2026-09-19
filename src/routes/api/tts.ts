import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return Response.json({ error: "Text-to-speech is not configured." }, { status: 500 });
        }

        let text: string;
        try {
          text = BodySchema.parse(await request.json()).text;
        } catch {
          return Response.json({ error: "Invalid text." }, { status: 400 });
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-tts-preview",
            contents: [
              {
                role: "user",
                parts: [{ text: `Say in a warm, friendly, natural conversational tone: ${text}` }],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
              },
            },
            stream_format: "sse",
          }),
        });

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          console.error(`TTS gateway failed [${response.status}]: ${detail}`);
          return Response.json(
            { error: "The voice service is unavailable right now." },
            { status: response.status === 429 || response.status >= 500 ? response.status : 502 },
          );
        }

        return new Response(response.body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});
