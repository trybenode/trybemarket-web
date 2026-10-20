import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, fontFamily } from "./theme.js";

/**
 * The motion-graphics kit shared by every video: kinetic type, wipes,
 * callouts, confetti, a drawn check mark, floating background shapes and the
 * step rail. All timing is in frames relative to the current Sequence.
 */

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
export const easeOut = { ...clamp, easing: Easing.out(Easing.cubic) };
export const easeInOut = { ...clamp, easing: Easing.inOut(Easing.cubic) };

export function useSpring(delay = 0, config = { damping: 200 }, durationInFrames) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config, durationInFrames });
}

/**
 * A headline whose words pop in one by one. Words wrapped in [brackets] get a
 * yellow highlighter swept under them once they land.
 */
export function Kinetic({ text, delay = 0, size = 86, color = C.slate900, stagger = 4, align = "center", style, marker = C.brandYellow, weight = 800 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{ fontFamily, fontSize: size, fontWeight: weight, color, lineHeight: 1.08, letterSpacing: -size * 0.025, textAlign: align, ...style }}>
      {words.map((raw, i) => {
        const highlight = raw.startsWith("[");
        const word = raw.replace(/[[\]]/g, "");
        const at = delay + i * stagger;
        const p = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 170, mass: 0.6 } });
        const sweep = interpolate(frame, [at + 8, at + 20], [0, 1], easeOut);
        return (
          <span key={i} style={{ display: "inline-block", position: "relative", marginRight: size * 0.24, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * size * 0.6}px) scale(${0.6 + 0.4 * p})` }}>
            {highlight && (
              <span
                style={{
                  position: "absolute",
                  left: -size * 0.08,
                  right: -size * 0.08,
                  bottom: size * 0.04,
                  height: size * 0.42,
                  background: marker,
                  borderRadius: size * 0.08,
                  transform: `scaleX(${sweep}) skewX(-8deg)`,
                  transformOrigin: "left center",
                  zIndex: -1,
                }}
              />
            )}
            <span style={{ position: "relative" }}>{word}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Slow-drifting brand shapes behind everything. */
export function FloatingShapes({ seed = "shapes", dark = false, count = 12 }) {
  const frame = useCurrentFrame();
  const colors = dark ? ["rgba(247,236,143,0.9)", "rgba(36,99,235,0.9)", "rgba(255,255,255,0.35)"] : [C.brandYellow, "rgba(36,99,235,0.85)", "rgba(15,23,42,0.12)"];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k) => random(`${seed}-${i}-${k}`);
        const kind = Math.floor(r("kind") * 4);
        const size = 26 + r("size") * 70;
        const x = r("x") * 1080 + Math.sin(frame / (40 + r("sx") * 50) + i) * 30;
        const y = r("y") * 1920 + Math.cos(frame / (50 + r("sy") * 50) + i) * 40 - frame * (0.3 + r("v") * 0.5);
        const yy = ((y % 2050) + 2050) % 2050 - 80;
        const rot = frame * (r("rot") - 0.5) * 2;
        const color = colors[Math.floor(r("c") * colors.length)];
        const common = { position: "absolute", left: x, top: yy, transform: `rotate(${rot}deg)`, opacity: dark ? 0.5 : 0.55 };
        if (kind === 0) return <div key={i} style={{ ...common, width: size, height: size, borderRadius: size, background: color }} />;
        if (kind === 1) return <div key={i} style={{ ...common, width: size, height: size, borderRadius: size, border: `${Math.max(4, size / 8)}px solid ${color}` }} />;
        if (kind === 2)
          return (
            <svg key={i} style={common} width={size} height={size} viewBox="0 0 10 10">
              <path d="M5 1v8M1 5h8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          );
        return (
          <svg key={i} style={common} width={size * 1.6} height={size * 0.6} viewBox="0 0 32 12">
            <path d="M2 6 Q6 1 10 6 T18 6 T26 6 T30 6" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
}

/** A dotted grid that slowly slides — texture for light scenes. */
export function DotGrid({ color = "rgba(15,23,42,0.07)" }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${color} 2.5px, transparent 2.5px)`,
        backgroundSize: "44px 44px",
        backgroundPosition: `${frame * 0.4}px ${frame * 0.6}px`,
      }}
    />
  );
}

/**
 * A diagonal colour wipe: a slanted panel sweeps across, covering the frame at
 * `at + 9` (cut the scenes there) and clearing by `at + 18`.
 */
export function Wipe({ at, color = C.primary, accent = C.brandYellow }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 20) return null;
  const x = interpolate(t, [0, 9, 18], [1500, 0, -1500], { ...clamp, easing: Easing.inOut(Easing.quad) });
  return (
    <AbsoluteFill style={{ zIndex: 100, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - 300, top: -400, width: 1700, height: 2800, background: accent, transform: "rotate(14deg)" }} />
      <div style={{ position: "absolute", left: x - 180, top: -400, width: 1700, height: 2800, background: color, transform: "rotate(14deg)" }} />
    </AbsoluteFill>
  );
}

/** A white camera flash. */
export function Flash({ at, peak = 0.95 }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 2, at + 14], [0, peak, 0], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "white", opacity: o, zIndex: 90 }} />;
}

/** A burst of confetti from (x, y). */
export function Confetti({ at, x = 540, y = 960, count = 90, seed = "confetti" }) {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 90) return null;
  const colors = [C.primary, C.brandYellow, "#10b981", "#f472b6", "#fb923c", C.slate900];
  return (
    <AbsoluteFill style={{ zIndex: 80, pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k) => random(`${seed}-${i}-${k}`);
        const angle = -Math.PI / 2 + (r("a") - 0.5) * Math.PI * 1.5;
        const speed = 22 + r("s") * 30;
        const px = x + Math.cos(angle) * speed * t;
        const py = y + Math.sin(angle) * speed * t + 0.9 * t * t;
        const w = 12 + r("w") * 14;
        const o = interpolate(t, [0, 60, 90], [1, 1, 0], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: w,
              height: w * (r("shape") > 0.5 ? 0.45 : 1),
              borderRadius: r("shape") > 0.8 ? w : 3,
              background: colors[i % colors.length],
              opacity: o,
              transform: `rotate(${t * (r("r") - 0.5) * 40}deg)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** A circle that fills, then a check mark drawn on it. */
export function CheckDraw({ at, size = 220, color = "#10b981" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 140 } });
  const draw = interpolate(frame, [at + 8, at + 22], [0, 1], easeOut);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `scale(${pop})`, overflow: "visible" }}>
      <circle cx="50" cy="50" r="46" fill={color} />
      <circle cx="50" cy="50" r={46 + (1 - pop) * 0 + interpolate(frame, [at, at + 24], [0, 14], clamp)} fill="none" stroke={color} strokeWidth="2" opacity={interpolate(frame, [at, at + 24], [0.6, 0], clamp)} />
      <path d="M29 51 L44 65 L72 36" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
    </svg>
  );
}

/**
 * A callout: a pulsing dot at `from`, a line drawn out to `to`, and a label
 * card that slides in there. Coordinates are frame pixels.
 */
export function Callout({ at, from, to, n, title, sub }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const dot = spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 180 } });
  const draw = interpolate(frame, [at + 4, at + 16], [0, 1], easeOut);
  const card = spring({ frame: frame - at - 12, fps, config: { damping: 14, stiffness: 160 } });
  const elbowX = to[0] - 40;
  const path = `M ${from[0]} ${from[1]} L ${elbowX} ${to[1]} L ${to[0]} ${to[1]}`;
  const pulse = 1 + 0.25 * Math.sin((frame - at) / 4);
  return (
    <AbsoluteFill style={{ zIndex: 40, pointerEvents: "none" }}>
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
        <path d={path} fill="none" stroke={C.slate900} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
        <circle cx={from[0]} cy={from[1]} r={22 * dot * pulse} fill="rgba(36,99,235,0.25)" />
        <circle cx={from[0]} cy={from[1]} r={12 * dot} fill={C.primary} stroke="white" strokeWidth="4" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: to[0],
          top: to[1],
          transform: `translateY(-50%) translateX(${(1 - card) * 40}px) scale(${0.7 + 0.3 * card})`,
          transformOrigin: "left center",
          opacity: Math.min(1, card * 1.5),
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 22px 16px 16px",
          borderRadius: 26,
          background: C.white,
          boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
          border: `3px solid ${C.slate900}`,
          fontFamily,
          maxWidth: 400,
        }}
      >
        <span style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 25, background: C.brandYellow, border: `3px solid ${C.slate900}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: C.slate900 }}>{n}</span>
        <span>
          <span style={{ display: "block", fontSize: 32, fontWeight: 800, color: C.slate900, lineHeight: 1.1 }}>{title}</span>
          {sub && <span style={{ display: "block", marginTop: 4, fontSize: 24, color: C.slate600 }}>{sub}</span>}
        </span>
      </div>
    </AbsoluteFill>
  );
}

/** A giant outlined step number that slides in behind the phone. */
export function OutlineNumber({ n, x = 600, y = 330, size = 560, color = C.primary }) {
  const p = useSpring(0, { damping: 16, stiffness: 90 });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -size * 0.05,
        color: "transparent",
        WebkitTextStroke: `6px ${color}`,
        opacity: 0.22 * p,
        transform: `translateX(${(1 - p) * 300}px) rotate(${(1 - p) * 12}deg)`,
      }}
    >
      {n}
    </div>
  );
}

/**
 * The step rail along the top: one pill per step, the current one filled and
 * labelled. `progress` (0–1) fills the current pill.
 */
export function Rail({ steps, active, progress = 1, top = 64 }) {
  const appear = useSpring(0);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top, display: "flex", gap: 14, fontFamily, opacity: appear, zIndex: 30 }}>
      {steps.map((label, i) => {
        const state = i < active ? 1 : i === active ? progress : 0;
        return (
          <div key={label} style={{ flex: i === active ? 2.2 : 1 }}>
            <div style={{ height: 12, borderRadius: 6, background: "rgba(15,23,42,0.1)", overflow: "hidden" }}>
              <div style={{ width: `${state * 100}%`, height: "100%", borderRadius: 6, background: C.primary }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700, color: i === active ? C.slate900 : C.slate400, whiteSpace: "nowrap" }}>
              {String(i + 1).padStart(2, "0")} {i === active ? label : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A rotated sticker label. */
export function Sticker({ text, delay = 0, rotate = -6, bg = C.brandYellow, color = C.slate900, size = 30, style }) {
  const p = useSpring(delay, { damping: 9, stiffness: 160 });
  return (
    <span
      style={{
        display: "inline-block",
        padding: `${size * 0.35}px ${size * 0.7}px`,
        borderRadius: size,
        background: bg,
        color,
        border: `3px solid ${C.slate900}`,
        fontFamily,
        fontSize: size,
        fontWeight: 800,
        transform: `rotate(${rotate}deg) scale(${p})`,
        boxShadow: `4px 4px 0 ${C.slate900}`,
        ...style,
      }}
    >
      {text}
    </span>
  );
}
