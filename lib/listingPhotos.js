/**
 * How many photos a listing may have, and which of a batch of picked files
 * fit. One number for the upload forms, the server check
 * (lib/listingValidation.js) and listing by WhatsApp. Pure.
 *
 * The forms used to hide the "add" button at five but let a seller pick any
 * number in one go, so some listings have more; those keep their photos
 * (editing is unaffected), they just can't add another.
 */
export const MAX_LISTING_PHOTOS = 5;

/**
 * @param {Array} picked         the files the seller just chose
 * @param {number} alreadyAdded  photos the listing already has
 * @returns {{ accepted: Array, skipped: number, message: string|null }}
 *   message: what to tell the seller when some or all didn't fit
 */
export function photosThatFit(picked, alreadyAdded, max = MAX_LISTING_PHOTOS) {
  const room = Math.max(0, max - alreadyAdded);
  const accepted = picked.slice(0, room);
  const skipped = picked.length - accepted.length;
  let message = null;
  if (skipped > 0 && accepted.length === 0) {
    message = `A listing can have up to ${max} photos. Remove one to add another.`;
  } else if (skipped > 0) {
    message = `A listing can have up to ${max} photos, so only the first ${accepted.length} ${accepted.length === 1 ? "was" : "were"} added.`;
  }
  return { accepted, skipped, message };
}
