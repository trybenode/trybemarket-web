import React from "react";
import { Composition } from "remotion";
import { KycWalkthrough, KYC_WALKTHROUGH_FRAMES } from "./KycWalkthrough.jsx";
import { FPS } from "./theme.js";

export function Root() {
  return (
    <Composition
      id="KycWalkthrough"
      component={KycWalkthrough}
      durationInFrames={KYC_WALKTHROUGH_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
    />
  );
}
