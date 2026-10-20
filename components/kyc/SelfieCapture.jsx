"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptPickedPhoto, pickFile, reportKycClientError } from "@/lib/kycClientUpload";

// In-app browsers (Instagram, Facebook, …) often block the camera for pages.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i;

/**
 * The fresher route's selfie. The live front camera is the default — taken
 * here, in the page. When the camera is blocked (often inside WhatsApp's or
 * Instagram's built-in browser), a file input that opens the front camera is
 * offered instead; on some phones it can also open the gallery, so the
 * source ("live" or "file") is reported and shown to the admin who reviews it.
 *
 * @param {{ value: File|null, onChange: (file: File|null, source: "live"|"file"|null) => void, disabled?: boolean }} props
 */
export default function SelfieCapture({ value, onChange, disabled = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [mode, setMode] = useState("idle"); // idle | live | blocked
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const inAppBrowser = typeof navigator !== "undefined" && IN_APP_BROWSER.test(navigator.userAgent);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => stopCamera, []);
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("blocked");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("live");
      // The <video> mounts on the "live" render.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (cameraError) {
      reportKycClientError("opening the selfie camera", cameraError);
      setMode("blocked");
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    stopCamera();
    setMode("idle");
    if (blob) onChange(new File([blob], "selfie.jpg", { type: "image/jpeg" }), "live");
  };

  const useFileFallback = async () => {
    setError(null);
    const file = await pickFile({ accept: "image/*", capture: "user" });
    if (!file) return;
    try {
      onChange(await acceptPickedPhoto(file), "file");
      setMode("idle");
    } catch (pickError) {
      setError(pickError.message);
    }
  };

  const browserHint = (
    <p className="text-[11px] leading-relaxed text-slate-600">
      In WhatsApp or Instagram? Open this page in <strong>Chrome</strong> or <strong>Safari</strong> (tap ⋮ or the
      share icon, then "Open in browser").
    </p>
  );

  return (
    <div className="space-y-3">
      {mode === "live" ? (
        <div className="space-y-3">
          <video
            ref={videoRef}
            playsInline
            muted
            className="mx-auto aspect-square w-full max-w-xs rounded-2xl bg-slate-900 object-cover [transform:scaleX(-1)]"
          />
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={capture}>
              <Camera /> Take selfie
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopCamera();
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5">
          <img src={preview} alt="Your selfie" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Selfie taken</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(null, null);
                startCamera();
              }}
              className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" /> Retake
            </button>
          </div>
        </div>
      ) : mode === "blocked" ? null : (
        <button
          type="button"
          disabled={disabled}
          onClick={startCamera}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-2.5 text-left transition hover:border-primary/50 active:scale-[0.99] disabled:opacity-60"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Camera className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-900">Take a selfie</span>
            <span className="block text-[11px] text-slate-500">Opens your front camera</span>
          </span>
        </button>
      )}

      {mode === "blocked" && (
        <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-xs text-slate-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            We couldn't open your camera here.
          </p>
          <Button type="button" variant="outline" size="sm" className="w-full" disabled={disabled} onClick={useFileFallback}>
            <Camera /> Use your phone's camera instead
          </Button>
          {browserHint}
        </div>
      )}
      {inAppBrowser && mode !== "blocked" && !preview && browserHint}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] text-slate-500">
        Good light, no sunglasses or cap. We compare it with the photo on your document.
      </p>
    </div>
  );
}
