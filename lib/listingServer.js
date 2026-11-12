/**
 * createListing, wired to the database: the checks and the save are
 * lib/listingCore.js; this adds the VIP tag, which has its own plan cap
 * (lib/rankScoreServer.js setVipTag). The listing is saved either way — if
 * the tag is refused the reason comes back in `vipError`, since a paid
 * feature quietly not applying is worse than being told.
 */
import { adminDB } from "./firebaseAdmin.js";
import { ListingError, createListingCore } from "./listingCore.js";
import { RankScoreError, setVipTag } from "./rankScoreServer.js";

export { ListingError };

/**
 * @param {string} uid   the signed-in (or WhatsApp-linked) seller — never taken from the request body
 * @param {"product"|"service"} type
 * @param {object} input
 * @param {{ isVip?: boolean, source?: "web"|"whatsapp" }} [options]
 * @returns {Promise<{ id: string, isVip: boolean, vipError: string|null }>}
 */
export async function createListing(uid, type, input, { isVip = false, source = "web" } = {}) {
  const { id } = await createListingCore(adminDB, {
    uid,
    type,
    input,
    source,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  });

  if (!isVip) return { id, isVip: false, vipError: null };
  try {
    await setVipTag(uid, type, id, true);
    return { id, isVip: true, vipError: null };
  } catch (error) {
    if (!(error instanceof RankScoreError)) console.error("VIP tag failed for a new listing:", error);
    return { id, isVip: false, vipError: error instanceof RankScoreError ? error.message : "The VIP tag couldn't be applied." };
  }
}
