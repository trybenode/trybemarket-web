import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BadgeCheck, Bell, Briefcase, Crown, GraduationCap, IdCard, Infinity as InfinityIcon, MessageCircle, Sparkles, TrendingUp, UserPlus } from "lucide-react";
import { C, fontFamily } from "./theme.js";
import { CheckDraw, Confetti, DotGrid, FloatingShapes, Kinetic, Sticker, Wipe, clamp, easeOut, useSpring } from "./motion.jsx";

/**
 * "Free Premium for the first 300" — 40 s, 1080×1920, for socials. The offer
 * as configured (promotion "Free 300 Users Premium"): the first 300 Lead City
 * students to be FULLY verified (student ID) get the Premium Bundle free for
 * 180 days. The voiceover is in videos/scripts/premium-offer-voiceover.txt,
 * timed to the scene starts below. No "spots left" number is shown — it
 * changes every day.
 */

const T = { hook: 0, spots: 135, value: 270, perks: 390, how: 720, cta: 1020, end: 1200 };
export const PREMIUM_OFFER_FRAMES = T.end;

function Twinkles({ seed, count = 18, color = C.brandYellow }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k) => random(`${seed}-${i}-${k}`);
        const phase = r("p") * 60;
        const o = Math.max(0, Math.sin((frame + phase) / (8 + r("s") * 8)));
        return (
          <Sparkles
            key={i}
            size={20 + r("z") * 30}
            color={color}
            style={{ position: "absolute", left: r("x") * 1040, top: r("y") * 1880, opacity: o * 0.9, transform: `rotate(${r("r") * 90}deg) scale(${0.6 + o * 0.6})` }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Hook() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const burst = interpolate(frame, [0, 14], [0, 2.8], easeOut);
  const free = spring({ frame: frame - 6, fps, config: { damping: 8, stiffness: 190, mass: 0.8 } });
  const premium = spring({ frame: frame - 20, fps, config: { damping: 14 } });
  const crown = spring({ frame: frame - 28, fps, config: { damping: 7, stiffness: 160 } });
  const shake = frame >= 6 && frame < 16 ? Math.sin(frame * 3) * (16 - frame) * 1.5 : 0;
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily, overflow: "hidden" }}>
      <FloatingShapes dark seed="offer-hook" />
      <Twinkles seed="hook" />
      <div style={{ position: "absolute", left: 140, top: 560, width: 800, height: 800, borderRadius: 400, background: C.brandYellow, transform: `scale(${burst})`, opacity: interpolate(frame, [6, 18], [1, 0], clamp) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateX(${shake}px)` }}>
        <div style={{ transform: `translateY(${(1 - crown) * -200}px) rotate(${(1 - crown) * 30 - 8}deg) scale(${crown})`, marginBottom: -20 }}>
          <Crown size={170} color={C.brandYellow} fill={C.brandYellow} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 330, fontWeight: 800, color: C.brandYellow, lineHeight: 0.92, letterSpacing: -14, transform: `scale(${free}) rotate(${(1 - free) * -18 - 3}deg)`, textShadow: `12px 12px 0 ${C.primary}` }}>FREE</div>
        <div style={{ marginTop: 18, fontSize: 132, fontWeight: 800, color: "white", letterSpacing: 6, opacity: premium, transform: `translateY(${(1 - premium) * 80}px)` }}>PREMIUM</div>
        <div style={{ marginTop: 34 }}>
          <Kinetic text="for [6 months]" delay={36} size={92} color="white" marker={C.primary} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Spots() {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [12, 62], [0, 300], easeOut));
  const pop = useSpring(10, { damping: 10 });
  const COLS = 20;
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily, alignItems: "center" }}>
      <DotGrid />
      <div style={{ marginTop: 230 }}>
        <Kinetic text="Only the first" delay={4} size={96} />
      </div>
      <div style={{ fontSize: 380, fontWeight: 800, color: C.navy, lineHeight: 0.95, letterSpacing: -16, transform: `scale(${pop})`, textShadow: `12px 12px 0 ${C.brandYellow}`, fontVariantNumeric: "tabular-nums" }}>{count}</div>
      <div style={{ marginTop: 10, width: 980 }}>
        <Kinetic text="[Lead City] students" delay={40} size={96} />
      </div>
      {/* 300 seats filling up with the count */}
      <div style={{ marginTop: 70, display: "grid", gridTemplateColumns: `repeat(${COLS}, 34px)`, gap: 9 }}>
        {Array.from({ length: 300 }).map((_, i) => {
          const on = i < count;
          return <div key={i} style={{ width: 34, height: 34, borderRadius: 10, background: on ? (i % 7 === 0 ? C.brandYellow : C.primary) : "rgba(15,23,42,0.08)", transform: `scale(${on ? 1 : 0.6})` }} />;
        })}
      </div>
      <div style={{ position: "absolute", bottom: 150 }}>{frame > 76 && <Sticker text="Spots are going fast ⚡" delay={78} size={40} rotate={-4} />}</div>
    </AbsoluteFill>
  );
}

function Value() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = useSpring(4, { damping: 14 });
  const strike = interpolate(frame, [38, 50], [0, 1], easeOut);
  const stamp = spring({ frame: frame - 54, fps, config: { damping: 9, stiffness: 200 } });
  const shake = frame >= 54 && frame < 64 ? Math.sin(frame * 3) * (64 - frame) * 1.6 : 0;
  return (
    <AbsoluteFill style={{ background: C.primary, fontFamily, alignItems: "center", justifyContent: "center", transform: `translateX(${shake}px)` }}>
      <FloatingShapes dark seed="offer-value" count={10} />
      <div style={{ color: "white", fontSize: 54, fontWeight: 700, opacity: card }}>6 months of Premium is worth</div>
      <div style={{ position: "relative", marginTop: 30, transform: `scale(${card})` }}>
        <div style={{ fontSize: 250, fontWeight: 800, color: "white", letterSpacing: -10, lineHeight: 1 }}>₦15,000</div>
        <div style={{ position: "absolute", left: -20, right: -20, top: "52%", height: 22, borderRadius: 11, background: C.brandYellow, transform: `scaleX(${strike}) rotate(-6deg)`, transformOrigin: "left center" }} />
      </div>
      <div style={{ marginTop: 60, transform: `scale(${interpolate(stamp, [0, 1], [3, 1])}) rotate(-8deg)`, opacity: Math.min(1, stamp * 2) }}>
        <div style={{ padding: "26px 70px", borderRadius: 40, background: C.brandYellow, border: `8px solid ${C.navy}`, boxShadow: `14px 14px 0 ${C.navy}`, fontSize: 150, fontWeight: 800, color: C.navy, letterSpacing: 4 }}>FREE</div>
      </div>
      <div style={{ marginTop: 50, fontSize: 40, color: "rgba(255,255,255,0.85)", opacity: interpolate(frame, [70, 84], [0, 1], clamp) }}>Premium Bundle · ₦2,500/month</div>
      <Confetti at={56} x={540} y={1150} />
    </AbsoluteFill>
  );
}

const PERKS = [
  { Icon: InfinityIcon, big: "Unlimited", small: "product listings", note: "Free plan: 3" },
  { Icon: Briefcase, big: "2 services", small: "listed at once", note: "Free plan: 1" },
  { Icon: Crown, big: "2 VIP tags", small: "to feature your best items" },
  { Icon: TrendingUp, big: "Rank higher", small: "in search and the feed" },
  { Icon: BadgeCheck, big: "Premium badge", small: "as a Premium seller" },
  { Icon: MessageCircle, big: "20 alerts", small: "a day, email & WhatsApp", note: "Free plan: 5" },
];

function Perk({ Icon, big, small, note, delay, index }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });
  const iconPop = spring({ frame: frame - delay - 8, fps, config: { damping: 6, stiffness: 200 } });
  const tilt = index % 2 === 0 ? -2 : 2;
  return (
    <div
      style={{
        padding: "34px 30px",
        borderRadius: 36,
        background: C.white,
        border: `5px solid ${C.navy}`,
        boxShadow: `10px 10px 0 ${C.navy}`,
        transform: `translateY(${(1 - p) * 120}px) rotate(${tilt * p + (1 - p) * tilt * 6}deg) scale(${0.7 + 0.3 * p})`,
        opacity: Math.min(1, p * 1.6),
      }}
    >
      <span style={{ display: "flex", width: 96, height: 96, borderRadius: 28, background: index % 3 === 1 ? C.brandYellow : C.primarySoft, border: `4px solid ${C.navy}`, alignItems: "center", justifyContent: "center", transform: `scale(${iconPop}) rotate(${(1 - iconPop) * -30}deg)` }}>
        <Icon size={52} color={index % 3 === 1 ? C.navy : C.primary} strokeWidth={2.4} />
      </span>
      <div style={{ marginTop: 22, fontSize: 52, fontWeight: 800, color: C.navy, lineHeight: 1.05 }}>{big}</div>
      <div style={{ marginTop: 6, fontSize: 30, color: C.slate600, lineHeight: 1.25 }}>{small}</div>
      {note && <div style={{ marginTop: 12, fontSize: 24, fontWeight: 600, color: C.slate400 }}>{note}</div>}
    </div>
  );
}

function Perks() {
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily }}>
      <DotGrid />
      <FloatingShapes seed="offer-perks" count={8} />
      <div style={{ position: "absolute", left: 60, right: 60, top: 120 }}>
        <Kinetic text="What you [get]" delay={2} size={110} />
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 330, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34 }}>
        {PERKS.map((perk, i) => (
          <Perk key={perk.big} {...perk} index={i} delay={24 + i * 42} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

const STEPS = [
  { Icon: UserPlus, title: "Sign up", text: "on trybemarket.online" },
  { Icon: GraduationCap, title: "Pick Lead City", text: "as your school" },
  { Icon: IdCard, title: "Verify with your student ID", text: "it takes about a minute" },
];

function Step({ Icon, title, text, n, delay }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140 } });
  const check = frame > delay + 50;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -260}px)` }}>
      <span style={{ position: "relative", width: 120, height: 120, flexShrink: 0, borderRadius: 60, background: check ? "#10b981" : C.primary, border: `5px solid ${C.navy}`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 54, fontWeight: 800 }}>
        {check ? <Icon size={56} color="white" strokeWidth={2.4} /> : n}
      </span>
      <span>
        <span style={{ display: "block", fontSize: 54, fontWeight: 800, color: C.navy, lineHeight: 1.08 }}>{title}</span>
        <span style={{ display: "block", marginTop: 6, fontSize: 34, color: C.slate600 }}>{text}</span>
      </span>
    </div>
  );
}

function How() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const NOTE_AT = 205;
  const note = spring({ frame: frame - NOTE_AT, fps, config: { damping: 11, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ background: C.cream, fontFamily }}>
      <DotGrid />
      <div style={{ position: "absolute", left: 70, right: 70, top: 130 }}>
        <Kinetic text="How to [claim] it" delay={2} size={110} align="left" />
      </div>
      <div style={{ position: "absolute", left: 80, right: 60, top: 400, display: "flex", flexDirection: "column", gap: 60 }}>
        {STEPS.map((step, i) => (
          <Step key={step.title} {...step} n={i + 1} delay={24 + i * 60} />
        ))}
      </div>
      {/* The notice they get when Premium is applied */}
      <div style={{ position: "absolute", left: 70, right: 70, top: 1250, transform: `translateY(${(1 - note) * 500}px)`, opacity: Math.min(1, note * 2) }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: C.slate600, marginBottom: 22, textAlign: "center" }}>Premium unlocks automatically</div>
        <div style={{ display: "flex", gap: 26, alignItems: "center", padding: "30px 32px", borderRadius: 40, background: "white", border: `5px solid ${C.navy}`, boxShadow: `12px 12px 0 ${C.navy}` }}>
          <span style={{ width: 100, height: 100, flexShrink: 0, borderRadius: 26, background: C.brandYellow, border: `4px solid ${C.navy}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bell size={52} color={C.navy} strokeWidth={2.4} />
          </span>
          <span>
            <span style={{ display: "block", fontSize: 28, fontWeight: 700, color: C.slate400 }}>TRYBEMARKET · NOW</span>
            <span style={{ display: "block", marginTop: 4, fontSize: 44, fontWeight: 800, color: C.navy, lineHeight: 1.1 }}>You've got Premium Bundle free 🎉</span>
          </span>
        </div>
      </div>
      <Confetti at={NOTE_AT + 6} x={540} y={1400} seed="claim" />
    </AbsoluteFill>
  );
}

function Cta() {
  const frame = useCurrentFrame();
  const card = useSpring(60, { damping: 12 });
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily, alignItems: "center" }}>
      <FloatingShapes dark seed="offer-cta" />
      <Twinkles seed="cta" count={14} />
      <div style={{ marginTop: 300 }}>
        <CheckDraw at={6} size={200} color={C.primary} />
      </div>
      <div style={{ marginTop: 60, width: 960 }}>
        <Kinetic text="Spots are [limited]" delay={16} size={120} color="white" marker={C.primary} />
      </div>
      <div style={{ marginTop: 26, width: 960 }}>
        <Kinetic text="Claim yours today" delay={36} size={84} color={C.brandYellow} />
      </div>
      <div style={{ position: "absolute", bottom: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 24, transform: `scale(${card})` }}>
        <div style={{ padding: "26px 46px", borderRadius: 36, background: "white" }}>
          <Img src={staticFile("logo.png")} style={{ width: 460, display: "block" }} />
        </div>
        <span style={{ fontSize: 50, fontWeight: 800, color: "white" }}>trybemarket.online</span>
      </div>
      <div style={{ position: "absolute", bottom: 240, right: 110 }}>{frame > 78 && <Sticker text="Verify today →" delay={80} size={38} rotate={-5} />}</div>
      <div style={{ position: "absolute", bottom: 70, left: 80, right: 80, textAlign: "center", fontSize: 24, lineHeight: 1.4, color: "rgba(255,255,255,0.55)", opacity: interpolate(frame, [90, 106], [0, 1], clamp) }}>
        For the first 300 Lead City students to fully verify with a student ID. Premium Bundle free for 180 days.
      </div>
    </AbsoluteFill>
  );
}

export function PremiumOffer() {
  return (
    <AbsoluteFill style={{ background: C.navy, fontFamily }}>
      <Sequence durationInFrames={T.spots + 10}>
        <Hook />
      </Sequence>
      <Sequence from={T.spots} durationInFrames={T.value - T.spots + 10}>
        <Spots />
      </Sequence>
      <Sequence from={T.value} durationInFrames={T.perks - T.value + 10}>
        <Value />
      </Sequence>
      <Sequence from={T.perks} durationInFrames={T.how - T.perks + 10}>
        <Perks />
      </Sequence>
      <Sequence from={T.how} durationInFrames={T.cta - T.how + 10}>
        <How />
      </Sequence>
      <Sequence from={T.cta}>
        <Cta />
      </Sequence>
      <Wipe at={T.spots - 9} />
      <Wipe at={T.value - 9} color={C.navy} />
      <Wipe at={T.perks - 9} />
      <Wipe at={T.how - 9} color={C.navy} />
      <Wipe at={T.cta - 9} />
    </AbsoluteFill>
  );
}
