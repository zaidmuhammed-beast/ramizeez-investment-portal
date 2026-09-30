"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import type { Capture } from "./camera-capture";

export type Challenge = { prompts: string[]; issuedAt: number; token: string };
export type LivenessResult = { challenge: Challenge; frames: Capture[] };

/**
 * Prompted selfie sequence: the server picks the prompts, the user performs each one on
 * camera, and one frame is captured per prompt after a short countdown.
 */
export function LivenessCapture({
  start,
  value,
  onChange,
  allowUpload,
}: {
  start: () => Promise<Challenge>;
  value?: LivenessResult;
  onChange: (r: LivenessResult | undefined) => void;
  allowUpload: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [frames, setFrames] = useState<Capture[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [ready, setReady] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setReady(false);
  };
  useEffect(() => stop, []);

  // Attach the stream once the <video> element has mounted.
  useEffect(() => {
    const video = videoRef.current;
    if (cameraOn && video && streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play();
    }
  }, [cameraOn]);

  async function begin() {
    setError(null);
    onChange(undefined);
    setFrames([]);
    const c = await start();
    setChallenge(c);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError(allowUpload ? "Camera unavailable. Upload one photo for each prompt instead." : "Camera unavailable. Allow camera access and try again.");
    }
  }

  function finish(all: Capture[], c: Challenge) {
    stop();
    onChange({ challenge: c, frames: all });
  }

  function snapAfterCountdown() {
    let n = 3;
    setCountdown(n);
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) return setCountdown(n);
      clearInterval(timer);
      setCountdown(null);
      const video = videoRef.current;
      if (!video || !challenge) return;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 1280);
      canvas.height = Math.round((canvas.width / video.videoWidth) * video.videoHeight);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const next = [...frames, { blob, url: URL.createObjectURL(blob), live: true }];
          setFrames(next);
          if (next.length === challenge.prompts.length) finish(next, challenge);
        },
        "image/jpeg",
        0.9,
      );
    }, 1000);
  }

  function onUpload(i: number, file: File | undefined) {
    if (!file || !challenge) return;
    const next = [...frames];
    next[i] = { blob: file, url: URL.createObjectURL(file), live: false };
    setFrames(next);
    if (next.filter(Boolean).length === challenge.prompts.length) finish(next, challenge);
  }

  if (value) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-brand-300">✓ Liveness check captured ({value.frames.length} frames)</p>
        <div className="grid grid-cols-3 gap-3">
          {value.frames.map((f, i) => (
            <figure key={i} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={value.challenge.prompts[i]} className="aspect-[3/4] w-full rounded-xl object-cover" />
              <figcaption className="text-[11px] text-slate-400">{value.challenge.prompts[i]}</figcaption>
            </figure>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={begin}>
          Redo liveness check
        </Button>
      </div>
    );
  }

  const current = challenge?.prompts[frames.length];

  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-[3/4] max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-ink-950/70">
        {cameraOn ? (
          <>
            <video ref={videoRef} playsInline muted onPlaying={() => setReady(true)} className="size-full -scale-x-100 object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-[10%] rounded-[50%] border-2 border-dashed border-brand-300/80" />
            {current && (
              <div className="absolute inset-x-3 bottom-3 rounded-xl bg-ink-950/80 p-3 text-center backdrop-blur" aria-live="assertive">
                <p className="text-xs text-slate-400">
                  Step {frames.length + 1} of {challenge!.prompts.length}
                </p>
                <p className="font-medium text-white">{current}</p>
              </div>
            )}
            {countdown !== null && (
              <div className="absolute inset-0 grid place-items-center text-7xl font-bold text-white/90">{countdown}</div>
            )}
          </>
        ) : (
          <div className="grid size-full place-items-center p-6 text-center text-sm text-slate-400">
            We&apos;ll ask you to do 3 quick movements on camera, to confirm you are a real person and match your ID photo.
          </div>
        )}
      </div>
      {error && <p className="text-center text-xs text-amber-300">{error}</p>}
      <div className="flex justify-center gap-2">
        {!challenge || (!cameraOn && !error) ? (
          <Button type="button" onClick={begin}>
            Start liveness check
          </Button>
        ) : cameraOn ? (
          <Button type="button" onClick={snapAfterCountdown} disabled={countdown !== null || !ready}>
            {!ready ? "Starting camera…" : countdown !== null ? "Hold still…" : "Capture this step"}
          </Button>
        ) : null}
      </div>
      {challenge && !cameraOn && allowUpload && (
        <div className="grid gap-3 sm:grid-cols-3">
          {challenge.prompts.map((p, i) => (
            <label key={p} className="glass cursor-pointer rounded-xl p-3 text-xs text-slate-300">
              <span className="block font-medium text-white">{p}</span>
              <span className="mt-1 block">{frames[i] ? "✓ Selected" : "Choose photo"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onUpload(i, e.target.files?.[0])} data-testid={`liveness-upload-${i}`} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
