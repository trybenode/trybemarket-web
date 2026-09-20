import { auth } from "@/lib/firebase";
import { STORAGE_KEYS, safeGet, safeSet } from "@/lib/pwa";

/**
 * Reports "this signed-in user is using the installed app" to the server, at
 * most once per user per device (local flag; the server is idempotent anyway,
 * so a cleared flag or a second device is harmless). Never throws — install
 * tracking must not affect the app — and the flag is set only after the
 * server answered, so a failed attempt is retried on the next launch.
 * Same token pattern as notifySignup in lib/referralClient.js.
 */
export async function reportInstall({ platform, source }) {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    const flagKey = STORAGE_KEYS.installRecordedPrefix + user.uid;
    if (safeGet(flagKey)) return true;

    const idToken = await user.getIdToken();
    const response = await fetch("/api/user/record-install", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ platform, source }),
    });
    if (response.ok) {
      safeSet(flagKey, "1");
      return true;
    }
    return false;
  } catch (error) {
    console.warn("Could not record app install:", error);
    return false;
  }
}
