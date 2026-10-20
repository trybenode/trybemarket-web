/**
 * Liveness check for the fresher route's selfie, behind one adapter so an
 * automated vendor can replace the manual review later without touching the
 * submission flow.
 *
 * Liveness proves a live person took part. It does NOT prove they're a Lead
 * City student — the document does that — and in this phase it compares
 * nothing: an admin looks at the selfie next to the document photo.
 *
 * Phase B candidates (check current pricing and Nigerian coverage first):
 * Smile ID, Dojah, Prembly, Youverify, AWS Rekognition Face Liveness.
 *
 * @returns {Promise<{ state: "passed"|"failed"|"unavailable"|"manual", provider: string, score?: number, checkedAt: number }>}
 */
export async function checkLiveness({ selfie, selfieSource }) {
  return { state: "manual", provider: "manual", selfieSource: selfieSource ?? null, checkedAt: Date.now() };
}
