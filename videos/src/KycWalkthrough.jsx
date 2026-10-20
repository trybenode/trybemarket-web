import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { GraduationCap, IdCard } from "lucide-react";
import { C, SCREEN_W, fontFamily } from "./theme.js";
import { Callout, CheckDraw, Confetti, DotGrid, Flash, FloatingShapes, Kinetic, OutlineNumber, Rail, Sticker, Wipe, clamp, easeInOut, easeOut, useSpring } from "./motion.jsx";
import { RiggedPhone, rigAt, toFrame } from "./rig.jsx";
import { DetailsScreen, PortalScreen, RouteScreen, SelfieScreen, UploadScreen } from "./screens.jsx";

/**
 * "How to verify on TrybeMarket" — 55 s, 1080×1920, for socials (the
 * voiceover is added in editing; see videos/scripts/kyc-voiceover.txt, whose
 * timings match the scene starts below).
 */

// Scene starts, in frames at 30 fps.
const T = {
  hook: 0,
  routes: 150,
  step1: 300,
  step2: 450,
  step3: 660,
  upload: 960,
  selfie: 1080,
  submit: 1300,
  outro: 1440,
  end: 1650,
};
export const KYC_WALKTHROUGH_FRAMES = T.end;

const PHONE_START = T.step1;
const L = (abs) => abs - PHONE_START; // frame on the phone's own timeline

// The camera around the phone (phone-timeline frames).
const PORTAL_RIG = { s: 0.8, dx: -200, dy: -20 };
const RIG = [
  [L(T.step1), { s: 0.55, dy: 1100, rx: 40, ry: -25, rz: -10 }],
  [L(T.step1) + 24, { s: 1 }],
  [L(T.step1) + 62, { s: 1 }],
  [L(T.step1) + 84, { s: 1.22, fy: 300 }],
  [L(T.step1) + 132, { s: 1.22, fy: 300 }],
  [L(T.step2) + 8, { s: 1, rz: 0 }],
  [L(T.step2) + 34, { s: 1.32, fy: 360 }],
  [L(T.step2) + 150, { s: 1.32, fy: 360 }],
  [L(T.step2) + 168, { s: 1 }],
  [L(T.step3) + 4, { s: 1 }],
  [L(T.step3) + 28, PORTAL_RIG],
  [L(T.step3) + 238, PORTAL_RIG],
  [L(T.step3) + 270, { s: 1 }],
  [L(T.upload) + 10, { s: 1 }],
  [L(T.upload) + 26, { s: 1.12, fy: 440 }],
  [L(T.upload) + 80, { s: 1.12, fy: 440 }],
  [L(T.upload) + 96, { s: 1 }],
  [L(T.selfie) + 24, { s: 1 }],
  [L(T.selfie) + 50, { s: 1.28, fy: 380 }],
  [L(T.selfie) + 150, { s: 1.28, fy: 380 }],
  [L(T.selfie) + 172, { s: 1 }],
  [L(T.submit) + 40, { s: 1 }],
  [L(T.submit) + 70, { s: 1.04, rz: -2 }],
];

// When each screen shows (absolute frames; each stays until the next has slid over it).
const SCREENS = [
  { Screen: RouteScreen, from: T.step1, length: T.step2 - T.step1 },
  { Screen: DetailsScreen, from: T.step2, length: T.step3 - T.step2 },
  { Screen: PortalScreen, from: T.step3, length: T.upload - T.step3 },
  { Screen: UploadScreen, from: T.upload, length: T.selfie - T.upload },
  { Screen: SelfieScreen, from: T.selfie, length: T.outro - T.selfie },
];

const STEPS = ["Route", "Details", "Document", "Selfie"];
const CAPTIONS = [
  { from: T.step1, to: T.step2, text: "Pick your [route]", n: "01" },
  { from: T.step2, to: T.step3, text: "Type your [details]", n: "02" },
  { from: T.step3, to: T.upload, text: "[Screenshot] your portal", n: "03" },
  { from: T.upload, to: T.selfie, text: "Add the [screenshot]", n: "03" },
  { from: T.selfie, to: T.submit, text: "Snap a quick [selfie]", n: "04" },
  { from: T.submit, to: T.outro, text: "Tick. [Submit.] Done.", n: "04" },
];

// What to check on the portal screenshot: a point on the phone screen → a label on the right.
const PORTAL_CALLOUTS = [
  { at: 70, point: [300, 736], label: [690, 1560], title: "portal.lcu.edu.ng", sub: "in the address bar" },
  { at: 102, point: [270, 396], label: [690, 1150], title: "Your name", sub: "as you typed it" },
  { at: 134, point: [300, 363], label: [690, 1010], title: "Matric number", sub: "the 7 digits" },
  { at: 166, point: [110, 523], label: [690, 1300], title: "Your level", sub: "100 or 200" },
];
const SHOT_AT = T.step3 + 214;

function Hook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const burst = interpolate(frame, [0, 14], [0, 2.6], easeOut);
  const burstOpacity = interpolate(frame, [6, 18], [1, 0], clamp);
  const sell = spring({ frame: frame - 14, fps, config: { damping: 8, stiffness: 180, mass: 0.8 } });
  const out = interpolate(frame, [60, 74], [0, 1], easeInOut);
  const reveal = interpolate(frame, [66, 86], [0, 1], easeInOut);
  const ring = interpolate(frame, [88, 140], [0, 1], easeOut);
  const watch = spring({ frame: frame - 84, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily, overflow: "hidden" }}>
      <FloatingShapes dark seed="hook" />
      <div style={{ position: "absolute", left: 540 - 400, top: 960 - 400, width: 800, height: 800, borderRadius: 400, background: C.brandYellow, transform: `scale(${burst})`, opacity: burstOpacity }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${-out * 260}px)`, opacity: 1 - out }}>
        <Kinetic text="Want to" delay={6} size={92} color="white" />
        <div style={{ fontSize: 330, fontWeight: 800, color: C.brandYellow, lineHeight: 0.95, letterSpacing: -14, transform: `scale(${sell}) rotate(${(1 - sell) * -20 - 4}deg)`, textShadow: `10px 10px 0 ${C.primary}` }}>SELL</div>
        <Kinetic text="on campus?" delay={26} size={104} color="white" />
      </AbsoluteFill>
      {/* Blue circle reveal into "Get verified in ~1 minute" */}
      <div style={{ position: "absolute", left: 540 - 1200, top: 960 - 1200, width: 2400, height: 2400, borderRadius: 1200, background: C.primary, transform: `scale(${reveal})` }} />
      {frame >= 80 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 }}>
          <Kinetic text="Get verified in about" delay={84} size={96} color="white" style={{ maxWidth: 900 }} />
          <div style={{ position: "relative", width: 420, height: 420, transform: `scale(${watch})` }}>
            <svg width="420" height="420" viewBox="0 0 100 100" style={{ position: "absolute", inset: 0 }}>
              <circle cx="50" cy="50" r="42" fill="rgba(255,255,255,0.12)" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={C.brandYellow} strokeWidth="7" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - ring} transform="rotate(-90 50 50)" />
              <rect x="44" y="0" width="12" height="6" rx="2" fill="white" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "white" }}>
              <span style={{ fontSize: 150, fontWeight: 800, lineHeight: 1 }}>1</span>
              <span style={{ fontSize: 46, fontWeight: 700 }}>minute</span>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function RouteCard({ Icon, title, sub, sticker, stickerBg, stickerColor, from, rotate, delay, top }) {
  const p = useSpring(delay, { damping: 14, stiffness: 120 });
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        top,
        padding: "44px 44px",
        borderRadius: 44,
        background: C.white,
        border: `5px solid ${C.navy}`,
        boxShadow: `14px 14px 0 ${C.navy}`,
        display: "flex",
        alignItems: "center",
        gap: 36,
        transform: `translateX(${(1 - p) * from}px) rotate(${rotate * p + (1 - p) * rotate * 4}deg)`,
      }}
    >
      <span style={{ width: 150, height: 150, flexShrink: 0, borderRadius: 36, background: C.primarySoft, border: `4px solid ${C.navy}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={84} color={C.primary} strokeWidth={2.2} />
      </span>
      <span>
        <span style={{ display: "block", fontSize: 54, fontWeight: 800, color: C.navy, lineHeight: 1.05 }}>{title}</span>
        <span style={{ display: "block", marginTop: 12, fontSize: 34, color: C.slate600, lineHeight: 1.25 }}>{sub}</span>
      </span>
      <div style={{ position: "absolute", right: -10, top: -38 }}>
        <Sticker text={sticker} delay={delay + 14} rotate={rotate > 0 ? -5 : 5} bg={stickerBg} color={stickerColor} size={30} />
      </div>
    </div>
  );
}

function TwoRoutes() {
  const frame = useCurrentFrame();
  const or = useSpring(30, { damping: 10 });
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily }}>
      <DotGrid />
      <FloatingShapes seed="routes" count={9} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 190 }}>
        <Kinetic text="Two ways to [verify]" delay={8} size={104} />
      </div>
      <RouteCard Icon={IdCard} title="Student ID card" sub="Any level — usually done in under a minute" sticker="Badge + 150 credit" from={-1200} rotate={-3} delay={18} top={620} />
      <div style={{ position: "absolute", left: 540 - 70, top: 1070, width: 140, height: 140, borderRadius: 70, background: C.navy, color: C.brandYellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, fontWeight: 800, transform: `scale(${or}) rotate(${(1 - or) * 180}deg)`, zIndex: 5 }}>
        or
      </div>
      <RouteCard Icon={GraduationCap} title="Fresher, no ID yet?" sub="Use your portal screenshot or library card" sticker="100 & 200 level" stickerBg={C.primary} stickerColor="white" from={1200} rotate={3} delay={40} top={1250} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 190, textAlign: "center", fontSize: 36, fontWeight: 600, color: C.slate600, opacity: interpolate(frame, [80, 96], [0, 1], clamp) }}>
        Next: the fresher route, step by step
      </div>
    </AbsoluteFill>
  );
}

/** The portal screenshot leaves the phone, waits in the corner, then drops into the upload box. */
function FlyingScreenshot() {
  const frame = useCurrentFrame(); // absolute
  const { fps } = useVideoConfig();
  if (frame < SHOT_AT || frame > T.upload + 50) return null;
  const pr = rigAt(L(SHOT_AT), RIG);
  const [x0, y0] = toFrame(SCREEN_W / 2, 422, pr);
  const startW = SCREEN_W * 1.62 * pr.s;
  const hold = { x: 935, y: 700, w: 170, rot: 8 };
  const upR = rigAt(L(frame), RIG);
  const [tx, ty] = toFrame(59, 440, upR, L(frame));
  const target = { x: tx, y: ty, w: 56 * 1.62 * upR.s, rot: 0 };
  const lift = spring({ frame: frame - SHOT_AT - 4, fps, config: { damping: 16, stiffness: 110 } });
  const drop = interpolate(frame, [T.upload + 30, T.upload + 48], [0, 1], easeInOut);
  const start = { x: x0, y: y0, w: startW, rot: 0 };
  const a = { x: start.x + (hold.x - start.x) * lift, y: start.y + (hold.y - start.y) * lift, w: start.w + (hold.w - start.w) * lift, rot: hold.rot * lift };
  const s = { x: a.x + (target.x - a.x) * drop, y: a.y + (target.y - a.y) * drop, w: a.w + (target.w - a.w) * drop, rot: a.rot * (1 - drop) };
  const h = s.w * (844 / 390);
  const bob = Math.sin(frame / 10) * 6 * (1 - drop) * lift;
  return (
    <div
      style={{
        position: "absolute",
        left: s.x - s.w / 2,
        top: s.y - h / 2 + bob,
        width: s.w,
        height: drop > 0.6 ? s.w : h,
        borderRadius: 14 + 10 * (1 - drop),
        overflow: "hidden",
        border: `${Math.max(3, 8 * (1 - drop))}px solid white`,
        boxShadow: "0 20px 50px rgba(15,23,42,0.35)",
        transform: `rotate(${s.rot}deg)`,
        zIndex: 60,
        opacity: frame > T.upload + 48 ? 0 : 1,
      }}
    >
      <Img src={staticFile("kyc-guides/portal-example.png")} style={{ width: "100%" }} />
    </div>
  );
}

function PortalCallouts() {
  const frame = useCurrentFrame(); // relative to T.step3
  const fade = interpolate(frame, [196, 210], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {PORTAL_CALLOUTS.map((c, i) => (
        <Callout key={c.title} at={c.at} n={i + 1} from={toFrame(c.point[0], c.point[1], rigAt(L(T.step3) + 40, RIG), L(T.step3 + frame))} to={c.label} title={c.title} sub={c.sub} />
      ))}
    </AbsoluteFill>
  );
}

function StepCaption({ text, n, from, to, fresh }) {
  const frame = useCurrentFrame(); // relative to `from`
  const length = to - from;
  const out = interpolate(frame, [length - 8, length], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 50, right: 50, top: 170, opacity: out }}>
        <Kinetic text={text} delay={2} size={100} />
      </div>
      {fresh && <OutlineNumber n={n} x={640} y={520} />}
    </AbsoluteFill>
  );
}

/** The step rail, filling as the steps go by. */
function StepRail() {
  const frame = useCurrentFrame() + T.step1; // absolute
  const STEP_SPANS = [
    [T.step1, T.step2],
    [T.step2, T.step3],
    [T.step3, T.selfie],
    [T.selfie, T.outro],
  ];
  const active = Math.max(0, STEP_SPANS.findIndex(([a, b]) => frame >= a && frame < b));
  const [a, b] = STEP_SPANS[active];
  return <Rail steps={STEPS} active={active} progress={interpolate(frame, [a, b], [0.1, 1], clamp)} />;
}

function Outro() {
  const frame = useCurrentFrame();
  const card = useSpring(118, { damping: 13 });
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily, alignItems: "center" }}>
      <FloatingShapes dark seed="outro" />
      <div style={{ marginTop: 230 }}>
        <CheckDraw at={10} size={240} />
      </div>
      <div style={{ marginTop: 60, width: 940 }}>
        <Kinetic text="We'll [email] you once you're approved" delay={24} size={80} color="white" />
      </div>
      <div style={{ marginTop: 60, width: 940 }}>
        <Kinetic text="Then start [selling]" delay={70} size={112} color={C.brandYellow} marker={C.primary} />
      </div>
      <div style={{ position: "absolute", bottom: 250, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, transform: `scale(${card})` }}>
        <div style={{ padding: "26px 46px", borderRadius: 36, background: "white" }}>
          <Img src={staticFile("logo.png")} style={{ width: 460, display: "block" }} />
        </div>
        <span style={{ fontSize: 46, fontWeight: 700, color: "white" }}>trybemarket.online</span>
      </div>
      <div style={{ position: "absolute", bottom: 150, right: 120, transform: "rotate(-4deg)" }}>{frame > 128 && <Sticker text="Verify today →" delay={130} size={36} />}</div>
      <div style={{ position: "absolute", bottom: 60, left: 80, right: 80, textAlign: "center", fontSize: 26, color: "rgba(255,255,255,0.6)", opacity: interpolate(frame, [140, 156], [0, 1], clamp) }}>
        Freshers are verified provisionally — add your student ID card once you have it.
      </div>
    </AbsoluteFill>
  );
}

export function KycWalkthrough() {
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily }}>
      <Sequence durationInFrames={T.routes + 10}>
        <Hook />
      </Sequence>
      <Sequence from={T.routes} durationInFrames={T.step1 - T.routes + 10}>
        <TwoRoutes />
      </Sequence>

      {/* Steps: background, captions, the phone, overlays */}
      <Sequence from={T.step1} durationInFrames={T.outro - T.step1 + 10}>
        <DotGrid />
        <FloatingShapes seed="steps" count={10} />
      </Sequence>
      {CAPTIONS.map((c, i) => (
        <Sequence key={c.from} from={c.from} durationInFrames={c.to - c.from}>
          <StepCaption {...c} fresh={CAPTIONS[i - 1]?.n !== c.n} />
        </Sequence>
      ))}
      <Sequence from={T.step1} durationInFrames={T.outro - T.step1}>
        <StepRail />
      </Sequence>
      <Sequence from={PHONE_START} durationInFrames={T.outro - PHONE_START + 10}>
        <RiggedPhone keys={RIG}>
          {SCREENS.map(({ Screen, from, length }) => (
            <Sequence key={from} from={from - PHONE_START} durationInFrames={length + 16} layout="none">
              <Screen />
            </Sequence>
          ))}
        </RiggedPhone>
      </Sequence>
      <Sequence from={T.step3} durationInFrames={212}>
        <PortalCallouts />
      </Sequence>
      <Flash at={SHOT_AT} />
      <FlyingScreenshot />
      <Confetti at={T.selfie + 282} x={540} y={1300} />

      <Sequence from={T.outro}>
        <Outro />
      </Sequence>

      <Wipe at={T.routes - 9} />
      <Wipe at={T.step1 - 9} color={C.navy} />
      <Wipe at={T.outro - 9} />
    </AbsoluteFill>
  );
}
