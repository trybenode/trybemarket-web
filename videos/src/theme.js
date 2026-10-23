import { loadFont } from "@remotion/google-fonts/Inter";

// The app's font and colours (app/layout.jsx, app/globals.css).
export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });

export const C = {
  primary: "#2463eb",
  primarySoft: "#e8efff",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
  emerald50: "#ecfdf5",
  emerald200: "#a7f3d0",
  emerald600: "#059669",
  amber50: "#fffbeb",
  amber200: "#fde68a",
  amber600: "#d97706",
  brandYellow: "#f7ec8f",
  white: "#ffffff",
  navy: "#0b1330",
  cream: "#fbf8ee",
};

export const FPS = 30;

// The phone's screen is laid out in iPhone points and scaled up, so the mock
// screens can use the same sizes as the real /kyc page.
export const SCREEN_W = 390;
export const SCREEN_H = 844;
export const PHONE_SCALE = 1.62;
