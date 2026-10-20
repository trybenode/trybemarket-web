import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { easeInOut } from "./motion.jsx";
import { PHONE_SCALE, SCREEN_H, SCREEN_W } from "./theme.js";
import { Phone } from "./ui.jsx";

/**
 * A phone on a camera rig. The phone's resting place is centred at
 * (PHONE_X, PHONE_Y); keyframes move a virtual camera around it:
 *
 *   [frame, { s, fx, fy, dx, dy, rx, ry, rz }]
 *     s        zoom
 *     fx, fy   a point on the SCREEN (390×844 points) to bring to the
 *              phone's resting centre while zoomed (omit for the centre)
 *     dx, dy   extra offset in frame pixels
 *     rx/ry/rz 3D tilt in degrees
 *
 * Values are eased between keyframes. `toFrame` maps a screen point to frame
 * pixels for a given rig state, so overlays (callouts, flying photos) can be
 * placed on top of the phone.
 */
export const BEZEL = 12;
export const PHONE_W = (SCREEN_W + BEZEL * 2) * PHONE_SCALE;
export const PHONE_H = (SCREEN_H + BEZEL * 2) * PHONE_SCALE;
export const PHONE_X = 540;
export const PHONE_Y = 1200;

const DEFAULTS = { s: 1, fx: SCREEN_W / 2, fy: SCREEN_H / 2, dx: 0, dy: 0, rx: 0, ry: 0, rz: 0 };

export function rigAt(frame, keys) {
  const frames = keys.map((k) => k[0]);
  const state = {};
  for (const name of Object.keys(DEFAULTS)) {
    const values = keys.map((k) => (k[1][name] ?? DEFAULTS[name]));
    state[name] = keys.length === 1 ? values[0] : interpolate(frame, frames, values, easeInOut);
  }
  return state;
}

/** The phone's gentle bob, in frame pixels. */
export const floatAt = (frame) => Math.sin(frame / 22) * 6;

/** Screen point (points) → frame pixels, for a rig state (ignores the 3D tilt). */
export function toFrame(x, y, r, frame = null) {
  const px = PHONE_X - PHONE_W / 2 + (BEZEL + x) * PHONE_SCALE;
  const py = PHONE_Y - PHONE_H / 2 + (BEZEL + y) * PHONE_SCALE;
  const { tx, ty } = offsets(r);
  return [PHONE_X + (px - PHONE_X) * r.s + tx, PHONE_Y + (py - PHONE_Y) * r.s + ty + (frame === null ? 0 : floatAt(frame))];
}

function offsets(r) {
  // Bring the focus point to the resting centre, then add the extra offset.
  const fx = (r.fx - SCREEN_W / 2) * PHONE_SCALE * r.s;
  const fy = (r.fy - SCREEN_H / 2) * PHONE_SCALE * r.s;
  return { tx: -fx + r.dx, ty: -fy + r.dy };
}

export function RiggedPhone({ keys, children }) {
  const frame = useCurrentFrame();
  const r = rigAt(frame, keys);
  const { tx, ty } = offsets(r);
  const float = floatAt(frame);
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
      <Phone
        style={{
          left: PHONE_X - PHONE_W / 2,
          top: PHONE_Y - PHONE_H / 2,
          transformOrigin: "center center",
          transform: `translate(${tx}px, ${ty + float}px) scale(${r.s}) rotateX(${r.rx}deg) rotateY(${r.ry}deg) rotateZ(${r.rz}deg)`,
        }}
      >
        {children}
      </Phone>
    </div>
  );
}
