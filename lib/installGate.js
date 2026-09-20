import { getStoredReferralCode } from "@/lib/referralClient";
import { normalizeReferralCode } from "@/lib/crsaConstants";

/**
 * The code a visitor arrived with, from the URL or an earlier capture. Used to
 * decide whether /install must first ask a signed-out visitor to sign up (see
 * app/install/page.jsx): the installed app's storage can be separate from the
 * browser's, so a referral has to be settled on the account before installing.
 */
export function getArrivalRef(urlRef) {
  return normalizeReferralCode(urlRef) || getStoredReferralCode();
}
