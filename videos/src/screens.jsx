import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BadgeCheck,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Coins,
  GraduationCap,
  IdCard,
  ImagePlus,
  Monitor,
  Store,
} from "lucide-react";
import { C, SCREEN_H, SCREEN_W } from "./theme.js";
import { AppHeader, BottomBar, Field, Screen, StatusBar, StepHeader, Tap, useTyped } from "./ui.jsx";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const PORTAL = staticFile("kyc-guides/portal-example.png");

/** A soft pulsing ring that draws the eye to a card. */
function glow(frame, from, to) {
  if (frame < from || frame > to) return "none";
  const o = interpolate(frame, [from, from + 8, to - 8, to], [0, 1, 1, 0], clamp);
  const pulse = 3 + 2 * Math.sin((frame - from) / 4);
  return `0 0 0 ${pulse}px rgba(36,99,235,${0.35 * o})`;
}

function Chip({ Icon, label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 24,
        padding: "0 8px",
        borderRadius: 12,
        border: `1px solid ${C.slate200}`,
        background: C.white,
        fontSize: 10.5,
        color: C.slate700,
      }}
    >
      <Icon size={11} color={C.primary} /> {label}
    </span>
  );
}

function RouteCard({ Icon, title, text, shadow, pressed }) {
  return (
    <div
      style={{
        height: 66,
        marginTop: 10,
        borderRadius: 16,
        background: C.white,
        border: `1px solid ${C.slate200}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 14px",
        boxShadow: shadow,
        transform: `scale(${pressed ? 0.98 : 1})`,
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 10, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} color={C.primary} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.slate900 }}>{title}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: C.slate500 }}>{text}</span>
      </span>
      <ChevronRight size={17} color={C.slate400} />
    </div>
  );
}

/** Step 1 — the start screen: two routes. Taps the fresher route at frame 125. */
export function RouteScreen() {
  const frame = useCurrentFrame();
  return (
    <Screen enter={false}>
      <StatusBar />
      <AppHeader />
      <div style={{ padding: "22px 20px 0" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.slate900 }}>Verify you're a student</div>
        <div style={{ marginTop: 3, fontSize: 13, color: C.slate500 }}>Takes about a minute.</div>
        <div style={{ display: "flex", gap: 6, marginTop: 12, marginBottom: 6 }}>
          <Chip Icon={Store} label="Sell & subscribe" />
          <Chip Icon={BadgeCheck} label="Verified badge" />
          <Chip Icon={Coins} label="150 App Credit" />
        </div>
        <RouteCard Icon={IdCard} title="I have my student ID card" text="Usually verified in under a minute" shadow={glow(frame, 35, 80)} />
        <RouteCard
          Icon={GraduationCap}
          title="I'm a fresher without an ID yet"
          text="100 or 200 level — portal or library card"
          shadow={glow(frame, 82, 128)}
          pressed={frame >= 125 && frame < 130}
        />
      </div>
      <Tap at={125} x={200} y={340} />
    </Screen>
  );
}

function DocChoice({ Icon, label, selected }) {
  return (
    <div
      style={{
        flex: 1,
        height: 44,
        borderRadius: 10,
        border: `1.5px solid ${selected ? C.primary : C.slate200}`,
        background: selected ? C.primarySoft : C.white,
        color: selected ? C.primary : C.slate700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Icon size={15} /> {label}
    </div>
  );
}

/** Step 2 — details: picks "Portal screenshot", types a name and the 7-digit number, taps Continue. */
export function DetailsScreen() {
  const frame = useCurrentFrame();
  const name = useTyped("Adeyemi Tolu Grace", 48, 2);
  const matric = useTyped("2601234", 112, 3);
  const portalPicked = frame >= 28;
  return (
    <Screen>
      <StatusBar />
      <AppHeader />
      <StepHeader step={1} title="Your details" subtitle="As they appear on your document." />
      <div style={{ padding: "0 20px" }}>
        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, color: C.slate800 }}>Which document do you have?</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <DocChoice Icon={Monitor} label="Portal screenshot" selected={portalPicked} />
          <DocChoice Icon={BookOpen} label="Library card" selected={false} />
        </div>
        <Field
          label="Full name"
          placeholder="e.g. Adeyemi Tolu Grace"
          value={name.value}
          hint="At least two names, as on your document."
          focused={frame >= 40 && frame < 104}
        />
        <Field
          label="Matriculation number"
          placeholder="e.g. 2601234"
          value={matric.value}
          hint="The 7 digits on your portal."
          focused={frame >= 104 && frame < 165}
        />
      </div>
      <BottomBar enabled={matric.done} pressed={frame >= 178 && frame < 183} />
      <Tap at={28} x={105} y={267} />
      <Tap at={42} x={190} y={350} />
      <Tap at={106} x={190} y={448} />
      <Tap at={178} x={195} y={786} />
    </Screen>
  );
}

// The example portal screenshot (684×1496) shown full-bleed; y positions are in image pixels.
const IMG_W = 684;
const IMG_H = 1496;
const LEGEND = [
  "portal.lcu.edu.ng in the address bar",
  "Student Dashboard",
  "The session line",
  "Matriculation Number",
  "Your name",
  "Your level",
];

/** Step 3b — upload: taps the portal-screenshot tile, the photo is added, taps Continue. */
export function UploadScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const addedAt = 50;
  const added = frame >= addedAt;
  const pop = spring({ frame: frame - addedAt, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <Screen>
      <StatusBar />
      <AppHeader />
      <StepHeader step={2} title="Your portal screenshot" subtitle="Clear and readable — see the example." />
      <div style={{ padding: "0 20px" }}>
        <div style={{ marginTop: 14, display: "flex", gap: 12, padding: 10, borderRadius: 16, border: `1px solid ${C.slate200}`, background: C.white }}>
          <div style={{ width: 74, height: 112, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.slate200}`, flexShrink: 0 }}>
            <Img src={PORTAL} style={{ width: 74, height: (74 * IMG_H) / IMG_W }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: C.slate500 }}>MAKE SURE THESE ARE VISIBLE</div>
            {LEGEND.map((item, i) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10.5, color: C.slate700 }}>
                <span style={{ width: 14, height: 14, borderRadius: 7, background: C.primary, color: "white", fontSize: 8.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.slate500 }}>Screenshot the whole screen — don't crop it.</div>
        <div
          style={{
            marginTop: 14,
            height: 78,
            borderRadius: 16,
            border: added ? `1px solid ${C.emerald200}` : `1.5px dashed ${C.slate300}`,
            background: added ? C.emerald50 : C.white,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 11px",
            transform: `scale(${frame >= 28 && frame < 33 ? 0.98 : 1})`,
          }}
        >
          {added ? (
            <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", transform: `scale(${pop})` }}>
              <Img src={PORTAL} style={{ width: 56, height: (56 * IMG_H) / IMG_W }} />
            </div>
          ) : (
            <span style={{ width: 56, height: 56, borderRadius: 12, background: C.slate100, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ImagePlus size={20} color={C.slate400} />
            </span>
          )}
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.slate900 }}>Portal screenshot</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 11.5, color: added ? C.emerald600 : C.slate500 }}>
              {added ? (
                <>
                  <Check size={13} strokeWidth={3} /> Added
                </>
              ) : (
                "The whole screen, address bar included"
              )}
            </span>
          </span>
        </div>
      </div>
      <BottomBar enabled={added} pressed={frame >= 100 && frame < 105} />
      <Tap at={28} x={195} y={440} />
      <Tap at={100} x={195} y={786} />
    </Screen>
  );
}

/** A friendly face for the camera preview (illustration — never a real person). */
function Face({ size = 300, tint = "#d9a273" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 300 300">
      <rect width="300" height="300" fill="#2b3a55" />
      <rect y="210" width="300" height="90" fill="#24324a" />
      <path d="M40 300 C55 225 105 205 150 205 C195 205 245 225 260 300 Z" fill="#3f63c9" />
      <rect x="128" y="168" width="44" height="46" rx="16" fill={tint} />
      <ellipse cx="150" cy="128" rx="58" ry="68" fill={tint} />
      <path d="M92 118 C92 70 120 54 150 54 C184 54 210 72 208 120 C196 96 176 88 150 88 C124 88 104 98 92 118 Z" fill="#1f1a17" />
      <circle cx="128" cy="130" r="5.5" fill="#1f1a17" />
      <circle cx="172" cy="130" r="5.5" fill="#1f1a17" />
      <path d="M131 162 Q150 176 169 162" stroke="#7a3b2a" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Face-detection brackets closing in, a scan line, then "Face found". */
function FaceFinder({ start }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lock = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120 } });
  const inset = interpolate(lock, [0, 1], [8, 52]);
  const scanY = 40 + ((frame - start) * 6) % 220;
  const found = frame >= start + 30;
  const corner = (rot, pos) => (
    <div
      style={{
        position: "absolute",
        width: 40,
        height: 40,
        borderTop: `5px solid ${found ? "#34d399" : "white"}`,
        borderLeft: `5px solid ${found ? "#34d399" : "white"}`,
        borderTopLeftRadius: 12,
        transform: `rotate(${rot}deg)`,
        ...pos,
      }}
    />
  );
  return (
    <>
      {frame >= start && !found && (
        <div style={{ position: "absolute", left: 50, right: 50, top: scanY, height: 3, background: "rgba(52,211,153,0.9)", boxShadow: "0 0 18px 4px rgba(52,211,153,0.6)" }} />
      )}
      <div style={{ position: "absolute", inset: inset - 4, top: inset - 18, opacity: Math.min(1, lock * 2) }}>
        {corner(0, { left: 0, top: 0 })}
        {corner(90, { right: 0, top: 0 })}
        {corner(270, { left: 0, bottom: 0 })}
        {corner(180, { right: 0, bottom: 0 })}
      </div>
      {found && (
        <div style={{ position: "absolute", left: "50%", bottom: 14, transform: `translateX(-50%) scale(${spring({ frame: frame - start - 30, fps, config: { damping: 10 } })})`, padding: "5px 12px", borderRadius: 20, background: "#10b981", color: "white", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
          ✓ Face found
        </div>
      )}
    </>
  );
}

/** Step 3 (fresher) — the example portal dashboard, full screen. */
export function PortalScreen() {
  return (
    <Screen background="#0b1020">
      <Img src={PORTAL} style={{ position: "absolute", left: 0, top: 0, width: SCREEN_W, height: (SCREEN_W * IMG_H) / IMG_W }} />
    </Screen>
  );
}

/** Step 4 — selfie, consent and submit, ending on the "Submitted" sheet. */
export function SelfieScreen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cameraAt = 30;
  const shotAt = 140;
  const tickAt = 228;
  const submitAt = 262;
  const sheetAt = 282;
  const live = frame >= cameraAt + 4 && frame < shotAt + 8;
  const taken = frame >= shotAt + 8;
  const flash = interpolate(frame, [shotAt, shotAt + 3, shotAt + 12], [0, 0.85, 0], clamp);
  const ticked = frame >= tickAt;
  const sheet = spring({ frame: frame - sheetAt, fps, config: { damping: 200 }, durationInFrames: 18 });
  const cameraIn = spring({ frame: frame - cameraAt - 4, fps, config: { damping: 200 }, durationInFrames: 12 });
  const breathe = 1 + 0.012 * Math.sin(frame / 9);

  return (
    <Screen>
      <StatusBar />
      <AppHeader />
      <StepHeader step={3} title="A quick selfie" subtitle="So our team can match you to your document." />
      <div style={{ padding: "0 20px" }}>
        {live ? (
          <div style={{ marginTop: 14, opacity: cameraIn }}>
            <div style={{ width: 300, height: 300, margin: "0 auto", borderRadius: 18, overflow: "hidden", position: "relative" }}>
              <div style={{ transform: `scale(${breathe})` }}>
                <Face />
              </div>
              <FaceFinder start={cameraAt + 20} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, height: 44, borderRadius: 10, background: C.primary, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, fontWeight: 600, transform: `scale(${frame >= shotAt && frame < shotAt + 5 ? 0.97 : 1})` }}>
                <Camera size={16} /> Take selfie
              </div>
              <div style={{ width: 86, height: 44, borderRadius: 10, border: `1px solid ${C.slate200}`, background: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 500, color: C.slate800 }}>
                Cancel
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              height: 78,
              borderRadius: 16,
              border: taken ? `1px solid ${C.emerald200}` : `1.5px dashed ${C.slate300}`,
              background: taken ? C.emerald50 : C.white,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "0 11px",
              transform: `scale(${frame >= cameraAt && frame < cameraAt + 4 ? 0.98 : 1})`,
            }}
          >
            {taken ? (
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden" }}>
                <Face size={56} />
              </div>
            ) : (
              <span style={{ width: 56, height: 56, borderRadius: 12, background: C.slate100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Camera size={20} color={C.slate400} />
              </span>
            )}
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.slate900 }}>{taken ? "Selfie taken" : "Take a selfie"}</span>
              <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: taken ? C.primary : C.slate500, fontWeight: taken ? 500 : 400 }}>
                {taken ? "↻ Retake" : "Opens your front camera"}
              </span>
            </span>
          </div>
        )}
        {!live && (
          <>
            <div style={{ marginTop: 10, fontSize: 11.5, color: C.slate500 }}>
              Good light, no sunglasses or cap. We compare it with the photo on your document.
            </div>
            {taken && (
              <div style={{ marginTop: 14, display: "flex", gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${C.slate200}`, background: C.white }}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    marginTop: 1,
                    borderRadius: 4,
                    border: `1.5px solid ${ticked ? C.primary : C.slate300}`,
                    background: ticked ? C.primary : C.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ticked && <Check size={12} color="white" strokeWidth={3.5} />}
                </span>
                <span style={{ fontSize: 11, lineHeight: 1.5, color: C.slate700 }}>
                  I agree that TrybeMarket keeps my document photos and selfie privately to confirm I'm a Lead City student.
                  Only the verification team can view them, and every view is logged.
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <BottomBar label={frame >= submitAt && frame < sheetAt ? "Submitting…" : "Submit"} enabled={ticked} pressed={frame >= submitAt && frame < submitAt + 5} />
      <div style={{ position: "absolute", inset: 0, background: "white", opacity: flash }} />

      {/* The "Submitted" result sheet */}
      <div style={{ position: "absolute", inset: 0, background: `rgba(15,23,42,${0.35 * sheet})` }} />
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 14,
          padding: "22px 20px 18px",
          borderRadius: 26,
          background: C.white,
          textAlign: "center",
          transform: `translateY(${(1 - sheet) * 360}px)`,
        }}
      >
        <span style={{ width: 46, height: 46, borderRadius: 14, background: C.primarySoft, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Clock size={22} color={C.primary} />
        </span>
        <div style={{ marginTop: 10, fontSize: 18, fontWeight: 700, color: C.slate900 }}>Submitted</div>
        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: C.slate600 }}>
          Our team will review your documents and email you when it's done.
        </div>
        <div style={{ marginTop: 16, height: 46, borderRadius: 12, background: C.primary, color: "white", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          Done
        </div>
      </div>

      <Tap at={cameraAt} x={195} y={262} />
      <Tap at={shotAt} x={150} y={560} />
      <Tap at={tickAt} x={44} y={377} />
      <Tap at={submitAt} x={195} y={786} />
    </Screen>
  );
}
