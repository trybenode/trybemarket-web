/**
 * Creating a listing — the one place it happens, for the website and (in
 * Phase 2) WhatsApp alike. Everything the browser used to be trusted with is
 * decided here:
 *
 *   - the seller must be KYC-cleared (lib/kycAccess.js)
 *   - the plan's listing limit holds: the count and the new listing are in
 *     ONE transaction, so two uploads at once can't both take the last slot
 *   - only the form's own fields are saved, cleaned (lib/listingValidation.js);
 *     owner, school, rank fields and VIP are set here, never taken from the caller
 *   - the listing is saved already ranked and searchable (sellerTier,
 *     rankScore, searchKeywords) — a listing without rankScore is invisible
 *     to the feed and to search
 *
 * `db` is passed in, so this file has no Firebase import and can be tested
 * with a fake (tests/listing/). The production wiring, including the VIP tag,
 * is lib/listingServer.js.
 */
import { isKycCleared } from "./kycAccess.js";
import { validateListingInput } from "./listingValidation.js";
import { UNLIMITED, getUserLimitsServer } from "./planLimitsServer.js";
import { computeRankScore, computeSearchKeywords } from "./rankScoreShared.js";
import { computeSellerTier } from "./sellerTier.js";

export class ListingError extends Error {
  /** @param {"not_found"|"kyc_required"|"invalid"|"limit_reached"} code */
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const COLLECTIONS = { product: "products", service: "services" };
const LIMIT_KEYS = { product: "maxProducts", service: "maxServices" };
const SOURCES = ["web", "whatsapp"];

/**
 * @param {object} options
 * @param {string} options.uid
 * @param {"product"|"service"} options.type
 * @param {object} options.input     the listing's details, as the upload forms send them
 * @param {"web"|"whatsapp"} [options.source]
 * @param {string} options.cloudName our Cloudinary account, for checking photo addresses
 * @returns {Promise<{ id: string, limit: number }>}
 * @throws {ListingError}
 */
export async function createListingCore(db, { uid, type, input, source = "web", cloudName, now = Date.now(), random = Math.random }) {
  const collectionName = COLLECTIONS[type];
  if (!collectionName) throw new ListingError("Unknown listing type.", 400, "invalid");

  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) throw new ListingError("Account not found.", 404, "not_found");
  const user = userSnap.data();
  if (!isKycCleared(user, now)) {
    throw new ListingError("Verify you're a student before listing.", 403, "kyc_required");
  }

  const checked = validateListingInput(type, input, { cloudName });
  if (!checked.ok) throw new ListingError(checked.error, 400, "invalid");

  const { limits, subs } = await getUserLimitsServer(db, uid, now);
  const limit = limits[LIMIT_KEYS[type]];
  const sellerTier = computeSellerTier(subs, type);
  const rankShuffleSeed = random();

  const data = {
    ...checked.data,
    userId: uid,
    university: user.selectedUniversity || "Unknown",
    createdAt: new Date(now),
    source: SOURCES.includes(source) ? source : "web",
    isVip: false,
    sellerTier,
    rankShuffleSeed,
    rankScore: computeRankScore({ sellerTier, isVip: false, isBoosted: false, boostEndDate: null, shuffleSeed: rankShuffleSeed }),
    searchKeywords: computeSearchKeywords(checked.data),
  };

  const ref = db.collection(collectionName).doc();
  await db.runTransaction(async (tx) => {
    if (limit < UNLIMITED) {
      const existing = await tx.get(db.collection(collectionName).where("userId", "==", uid).select());
      if (existing.size >= limit) {
        throw new ListingError(
          `You've reached your limit of ${limit} ${type}${limit === 1 ? "" : "s"}. Upgrade to add more!`,
          403,
          "limit_reached"
        );
      }
    }
    tx.create(ref, data);
  });
  return { id: ref.id, limit };
}
