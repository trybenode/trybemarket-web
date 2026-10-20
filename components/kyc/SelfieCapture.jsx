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
    if (!value) return setPreview(null);
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
    <p className="text-xs leading-relaxed text-slate-600">
      If the camera won't open, you may be in WhatsApp's or Instagram's built-in browser. Open this page in{" "}
      <strong>Chrome</strong> or <strong>Safari</strong> instead (tap ⋮ or the share icon, then "Open in browser").
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
            className="aspect-square w-full rounded-2xl bg-slate-900 object-cover [transform:scaleX(-1)]"
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
        <div className="flex items-center gap-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 p-3">
          <img src={preview} alt="Your selfie" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Selfie taken</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                onChange(null, null);
                startCamera();
              }}
            >
              <RefreshCw /> Retake
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-14 w-full" disabled={disabled} onClick={startCamera}>
          <Camera /> Open camera for a selfie
        </Button>
      )}

      {mode === "blocked" && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-start gap-2 text-sm text-slate-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            We couldn't open your camera here.
          </p>
          <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={useFileFallback}>
            <Camera /> Use your phone's camera instead
          </Button>
          {browserHint}
        </div>
      )}
      {inAppBrowser && mode !== "blocked" && !preview && browserHint}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">
        Face the camera in good light, without sunglasses or a cap. Our team compares it with the photo on your document.
      </p>
    </div>
  );
}
