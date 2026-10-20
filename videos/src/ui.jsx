import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { C, SCREEN_H, SCREEN_W, PHONE_SCALE, fontFamily } from "./theme.js";

/** A phone; children are laid out in a 390×844 screen. */
export function Phone({ children, style }) {
  const bezel = 12;
  return (
    <div
      style={{
        position: "absolute",
        width: (SCREEN_W + bezel * 2) * PHONE_SCALE,
        height: (SCREEN_H + bezel * 2) * PHONE_SCALE,
        borderRadius: 64 * PHONE_SCALE,
        background: "#0b1020",
        boxShadow: "0 40px 90px rgba(15,23,42,0.28), 0 8px 24px rgba(15,23,42,0.18)",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: bezel * PHONE_SCALE,
          top: bezel * PHONE_SCALE,
          width: SCREEN_W,
          height: SCREEN_H,
          transform: `scale(${PHONE_SCALE})`,
          transformOrigin: "top left",
          borderRadius: 52,
          overflow: "hidden",
          background: C.slate50,
          fontFamily,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Full-screen layer inside the phone that slides in from the right. */
export function Screen({ children, enter = true, background = C.slate50 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = enter ? spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 }) : 1;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background,
        transform: `translateX(${(1 - p) * SCREEN_W}px)`,
        boxShadow: p < 1 ? "-12px 0 30px rgba(0,0,0,0.12)" : "none",
      }}
    >
      {children}
    </div>
  );
}

export function StatusBar({ dark = false }) {
  const color = dark ? C.white : C.slate900;
  return (
    <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px 0 36px", color }}>
      <span style={{ fontSize: 16, fontWeight: 600 }}>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[6, 9, 12, 15].map((h) => (
          <span key={h} style={{ width: 3.5, height: h, borderRadius: 1, background: color }} />
        ))}
        <span style={{ marginLeft: 6, width: 25, height: 12, borderRadius: 4, border: `1.5px solid ${color}`, padding: 1.5 }}>
          <span style={{ display: "block", width: "80%", height: "100%", borderRadius: 2, background: color }} />
        </span>
      </span>
    </div>
  );
}

export function AppHeader() {
  return (
    <div
      style={{
        height: 54,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 18px",
        background: C.white,
        borderBottom: `1px solid ${C.slate200}`,
      }}
    >
      <ArrowLeft size={20} color={C.slate800} />
      <span style={{ fontSize: 17, fontWeight: 600, color: C.slate900 }}>Verification</span>
      <span style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 15, border: `1.5px solid ${C.primary}`, background: C.primarySoft }} />
    </div>
  );
}

/** "‹ STEP 2 OF 3", the progress bar, a title and a subtitle. */
export function StepHeader({ step, title, subtitle }) {
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.slate500 }}>
        <ChevronLeft size={18} color={C.slate700} />
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>STEP {step} OF 3</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
        {[1, 2, 3].map((i) => (
          <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.primary : C.slate200 }} />
        ))}
      </div>
      <div style={{ marginTop: 16, fontSize: 19, fontWeight: 700, color: C.slate900 }}>{title}</div>
      <div style={{ marginTop: 3, fontSize: 12.5, color: C.slate500 }}>{subtitle}</div>
    </div>
  );
}

/** The fixed bottom action bar with the page's main button. */
export function BottomBar({ label = "Continue", enabled = true, pressed = false }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "14px 20px 34px",
        background: C.white,
        borderTop: `1px solid ${C.slate200}`,
      }}
    >
      <div
        style={{
          height: 48,
          borderRadius: 12,
          background: C.primary,
          opacity: enabled ? 1 : 0.45,
          color: C.white,
          fontSize: 15,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${pressed ? 0.97 : 1})`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/**
 * A finger tap: the touch dot fades in at (x, y), presses at frame `at`
 * (relative to the current Sequence), ripples, and fades out.
 */
export function Tap({ at, x, y }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < -14 || t > 16) return null;
  const opacity = interpolate(t, [-14, -6, 8, 16], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const press = interpolate(t, [-4, 0, 5], [1, 0.78, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ripple = interpolate(t, [0, 14], [0.6, 2.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleOpacity = interpolate(t, [0, 14], [0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 50, opacity }}>
      {t >= 0 && (
        <div
          style={{
            position: "absolute",
            left: -24,
            top: -24,
            width: 48,
            height: 48,
            borderRadius: 24,
            border: `3px solid ${C.primary}`,
            opacity: rippleOpacity,
            transform: `scale(${ripple})`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: -20,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: 20,
          background: "rgba(255,255,255,0.75)",
          border: `3px solid ${C.primary}`,
          boxShadow: "0 4px 14px rgba(36,99,235,0.35)",
          transform: `scale(${press})`,
        }}
      />
    </div>
  );
}

/** Text typed out from frame `start`, `perChar` frames a character, with a caret while focused. */
export function useTyped(text, start, perChar = 2) {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - start) / perChar)));
  return { value: text.slice(0, n), done: n >= text.length, typing: frame >= start - 6 };
}

export function Field({ label, placeholder, value, hint, focused }) {
  const frame = useCurrentFrame();
  const caret = focused && Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.slate800 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          height: 44,
          borderRadius: 10,
          border: `1.5px solid ${focused ? C.primary : C.slate200}`,
          boxShadow: focused ? `0 0 0 3px ${C.primarySoft}` : "none",
          background: C.white,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          fontSize: 15,
          color: value ? C.slate900 : C.slate400,
        }}
      >
        {value || placeholder}
        {caret && <span style={{ marginLeft: 1, width: 1.5, height: 19, background: C.primary }} />}
      </div>
      {hint && <div style={{ marginTop: 5, fontSize: 11.5, color: C.slate500 }}>{hint}</div>}
    </div>
  );
}
