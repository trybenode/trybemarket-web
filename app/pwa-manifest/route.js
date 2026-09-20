import { NextResponse } from "next/server";
import { buildManifest } from "@/lib/pwaManifest";

// Same manifest as /manifest.webmanifest, with ?ref=CODE carried into
// start_url. Linked by components/ManifestRefLink.jsx whenever the visitor
// arrived through an ambassador's link. See lib/pwaManifest.js for why.
export async function GET(request) {
  const ref = new URL(request.url).searchParams.get("ref");
  return new NextResponse(JSON.stringify(buildManifest({ ref })), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
