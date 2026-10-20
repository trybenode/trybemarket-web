import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BookOpen, Check, IdCard } from "lucide-react";
import { C, PHONE_SCALE, SCREEN_W, fontFamily } from "./theme.js";
import { Phone } from "./ui.jsx";
import { DetailsScreen, GuideScreen, RouteScreen, SelfieScreen, UploadScreen } from "./screens.jsx";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

// Timeline, in frames at 30 fps.
const INTRO = 90;
const SCENES = [
  { Screen: RouteScreen, length: 180, captions: [{ step: "Step 1", title: "Pick how you'll verify", text: "Student ID card? Pick the first. A fresher in 100 or 200 level? Pick the second." }] },
  { Screen: DetailsScreen, length: 210, captions: [{ step: "Step 2", title: "Type your details", text: "Your name and number exactly as they appear on your document." }] },
  { Screen: GuideScreen, length: 270, captions: [{ step: "Step 3", title: "Screenshot your portal", text: "On portal.lcu.edu.ng, open your Student Dashboard and screenshot the whole screen." }] },
  { Screen: UploadScreen, length: 150, captions: [{ step: "Step 3", title: "Add the screenshot", text: "Tap the box and choose it from your photos." }] },
  {
    Screen: SelfieScreen,
    length: 300,
    captions: [
      { step: "Step 4", title: "Take a quick selfie", text: "Good light — no sunglasses or cap. We match it to your document." },
      { at: 150, step: "Step 4", title: "Tick the box and submit", text: "That's it. We'll email you as soon as it's reviewed." },
    ],
  },
];
const OUTRO = 150;
let cursor = INTRO;
const TIMED = SCENES.map((scene) => {
  const start = cursor;
  cursor += scene.length;
  return { ...scene, start };
});
const MAIN_END = cursor;
export const KYC_WALKTHROUGH_FRAMES = MAIN_END + OUTRO;

function Background() {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 30;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #eef3ff 0%, #f8fafc 55%, #ffffff 100%)" }}>
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: 350, left: -260 + drift, top: -220, background: "radial-gradient(circle, rgba(36,99,235,0.16), rgba(36,99,235,0) 70%)" }} />
      <div style={{ position: "absolute", width: 640, height: 640, borderRadius: 320, right: -240 - drift, top: 760, background: "radial-gradient(circle, rgba(247,236,143,0.55), rgba(247,236,143,0) 70%)" }} />
    </AbsoluteFill>
  );
}

/** The step chip, headline and one line of help above the phone. */
function Caption({ step, title, text }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 92, textAlign: "center", fontFamily, opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <span style={{ display: "inline-block", padding: "10px 24px", borderRadius: 40, background: C.primary, color: "white", fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>
        {step.toUpperCase()}
      </span>
      <div style={{ marginTop: 22, fontSize: 70, lineHeight: 1.08, fontWeight: 800, color: C.slate900, letterSpacing: -1.5 }}>{title}</div>
      <div style={{ marginTop: 18, fontSize: 36, lineHeight: 1.3, color: C.slate600 }}>{text}</div>
    </div>
  );
}

function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14 } });
  const text = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const out = interpolate(frame, [INTRO - 12, INTRO], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily, opacity: out }}>
      <Img src={staticFile("logo.png")} style={{ width: 620, transform: `scale(${logo})` }} />
      <div style={{ marginTop: 60, fontSize: 84, fontWeight: 800, color: C.slate900, textAlign: "center", lineHeight: 1.05, letterSpacing: -2, opacity: text, transform: `translateY(${(1 - text) * 30}px)` }}>
        Verify your
        <br />
        student account
      </div>
      <div style={{ marginTop: 28, fontSize: 40, color: C.slate600, opacity: text }}>It takes about a minute</div>
    </AbsoluteFill>
  );
}

function Tip({ Icon, title, text, delay }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ display: "flex", gap: 26, alignItems: "flex-start", padding: "30px 34px", borderRadius: 34, background: C.white, border: `2px solid ${C.slate200}`, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, textAlign: "left" }}>
      <span style={{ width: 76, height: 76, flexShrink: 0, borderRadius: 22, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={40} color={C.primary} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: 36, fontWeight: 700, color: C.slate900 }}>{title}</span>
        <span style={{ display: "block", marginTop: 8, fontSize: 30, lineHeight: 1.35, color: C.slate600 }}>{text}</span>
      </span>
    </div>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badge = spring({ frame: frame - 6, fps, config: { damping: 11 } });
  const text = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily, padding: "0 80px 120px", textAlign: "center" }}>
      <span style={{ width: 150, height: 150, borderRadius: 75, background: C.emerald600, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badge})`, boxShadow: "0 20px 50px rgba(5,150,105,0.35)" }}>
        <Check size={86} color="white" strokeWidth={3.5} />
      </span>
      <div style={{ marginTop: 50, fontSize: 84, fontWeight: 800, color: C.slate900, letterSpacing: -2, opacity: text }}>That's it!</div>
      <div style={{ marginTop: 20, fontSize: 40, lineHeight: 1.35, color: C.slate600, opacity: text }}>
        We'll email you once it's reviewed — then you can start selling.
      </div>
      <div style={{ marginTop: 70, display: "flex", flexDirection: "column", gap: 26, width: "100%" }}>
        <Tip Icon={IdCard} title="Have your student ID card?" text="Pick “I have my student ID card” and add photos of the front and back." delay={34} />
        <Tip Icon={BookOpen} title="No portal access?" text="Freshers can use their library card instead — a photo of each side." delay={48} />
      </div>
      <div style={{ marginTop: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: text }}>
        <Img src={staticFile("logo.png")} style={{ width: 360 }} />
        <span style={{ fontSize: 34, fontWeight: 600, color: C.primary }}>trybemarket.online</span>
      </div>
    </AbsoluteFill>
  );
}

const PHONE_W = (SCREEN_W + 24) * PHONE_SCALE;
const PHONE_TOP = 470;

export function KycWalkthrough() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame: frame - INTRO + 4, fps, config: { damping: 200 }, durationInFrames: 22 });
  const phoneOut = spring({ frame: frame - MAIN_END, fps, config: { damping: 200 }, durationInFrames: 18 });
  const phoneY = (1 - phoneIn) * 1500 + phoneOut * 1600;
  // Caption out with the phone, so the outro starts on a clean page.
  const mainOpacity = interpolate(frame, [MAIN_END, MAIN_END + 10], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      <Sequence durationInFrames={INTRO}>
        <Intro />
      </Sequence>

      <AbsoluteFill style={{ opacity: mainOpacity }}>
        {TIMED.map((scene) =>
          scene.captions.map((caption, i) => {
            const from = scene.start + (caption.at || 0);
            const next = scene.captions[i + 1];
            const until = next ? scene.start + next.at : scene.start + scene.length;
            return (
              <Sequence key={`${scene.start}-${i}`} from={from} durationInFrames={until - from}>
                <Caption {...caption} />
              </Sequence>
            );
          })
        )}
      </AbsoluteFill>

      {frame >= INTRO - 4 && frame < MAIN_END + 20 && (
        <Phone style={{ left: (1080 - PHONE_W) / 2, top: PHONE_TOP, transform: `translateY(${phoneY}px)` }}>
          {TIMED.map(({ Screen, start, length }) => (
            // Each screen stays until the next one has slid over it.
            <Sequence key={start} from={start} durationInFrames={length + 16} layout="none">
              <Screen />
            </Sequence>
          ))}
        </Phone>
      )}

      <Sequence from={MAIN_END + 6}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
}
