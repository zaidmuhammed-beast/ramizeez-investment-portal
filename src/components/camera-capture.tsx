"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { cn } from "./ui/cn";

export type Capture = { blob: Blob; url: string; live: boolean };

/**
 * Live camera capture (front or rear camera). Falls back to a file picker only when
 * `allowUpload` is set — uploads are flagged to reviewers as "not live".
 */
export function CameraCapture({
  facing,
  label,
  value,
  onChange,
  allowUpload,
  overlay = "document",
  hint,
}: {
  facing: "user" | "environment";
  label: string;
  value?: Capture;
  onChange: (c: Capture | undefined) => void;
  allowUpload: boolean;
  overlay?: "document" | "face";
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
    setReady(false);
  }, []);

  useEffect(() => stop, [stop]);

  // Attach the stream once the <video> element has mounted.
  useEffect(() => {
    const video = videoRef.current;
    if (active && video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play();
    }
  }, [active]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError(allowUpload ? "Camera unavailable. You can upload a photo instead." : "Camera unavailable. Allow camera access in your browser settings and try again.");
    }
  }

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1600 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onChange({ blob, url: URL.createObjectURL(blob), live: true });
        stop();
      },
      "image/jpeg",
      0.9,
    );
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    onChange({ blob: file, url: URL.createObjectURL(file), live: false });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {value && <span className="text-xs text-brand-300">{value.live ? "✓ Captured live" : "✓ Uploaded"}</span>}
      </div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-ink-950/70">
        {value && !active && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={label} className="size-full object-contain" />
        )}
        {active && (
          <>
            <video ref={videoRef} playsInline muted onPlaying={() => setReady(true)} className={cn("size-full object-cover", facing === "user" && "-scale-x-100")} />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute border-2 border-dashed border-brand-300/80",
                overlay === "document" ? "inset-[12%] rounded-xl" : "left-1/2 top-1/2 h-[75%] aspect-[3/4] -translate-x-1/2 -translate-y-1/2 rounded-[50%]",
              )}
            />
          </>
        )}
        {!value && !active && (
          <div className="grid size-full place-items-center p-6 text-center text-sm text-slate-400">{hint ?? "Camera preview appears here"}</div>
        )}
      </div>
      {error && <p className="text-xs text-amber-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {active ? (
          <>
            <Button type="button" onClick={snap} disabled={!ready}>
              {ready ? "Capture" : "Starting camera…"}
            </Button>
            <Button type="button" variant="ghost" onClick={stop}>
              Cancel
            </Button>
          </>
        ) : (
          <Button type="button" variant={value ? "secondary" : "primary"} onClick={start}>
            {value ? "Retake" : "Open camera"}
          </Button>
        )}
        {allowUpload && !active && (
          <label className="glass inline-flex cursor-pointer items-center rounded-xl px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10">
            Upload photo
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid={`upload-${label}`} />
          </label>
        )}
      </div>
    </div>
  );
}
