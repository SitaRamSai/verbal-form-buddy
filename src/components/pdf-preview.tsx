import { useEffect, useRef, useState } from "react";

type Props = {
  /** Flattened PDF bytes to render. */
  bytes: Uint8Array | null;
};

/** Renders page 1 of a PDF onto a canvas so it displays in every browser. */
export function PdfPreview({ bytes }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const page = await doc.getPage(1);
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      const containerWidth = canvas.parentElement?.clientWidth ?? 600;
      const base = page.getViewport({ scale: 1 });
      const scale = (containerWidth / base.width) * (window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";

      const context = canvas.getContext("2d");
      if (!context) return;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      if (!cancelled) setReady(true);
    })().catch(() => {
      if (!cancelled) setError("Couldn't display the application PDF.");
    });

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  return (
    <div className="relative w-full bg-background">
      {error && <p className="p-6 text-sm text-muted-foreground">{error}</p>}
      {!error && !ready && (
        <p className="p-6 text-sm text-muted-foreground">
          Loading the application form…
        </p>
      )}
      <canvas
        ref={canvasRef}
        aria-label="Utility Assistance Application, page 1"
        className={error ? "hidden" : "block w-full"}
      />
    </div>
  );
}
