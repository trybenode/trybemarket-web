/**
 * Checks and cleans what a seller sends when creating a listing, before the
 * server saves it (lib/listingServer.js). Pure. Only the fields the upload
 * forms send are kept — anything else in the request is dropped, so a caller
 * can't set rank, VIP, boost or owner fields.
 *
 * The forms enforce their own "fill everything in" rules; these are the
 * limits that must hold whoever is calling (the website, WhatsApp, or
 * someone talking to the API directly). The text limits are deliberately
 * roomy: they were checked against every listing in production, so nothing a
 * seller types into the forms today is refused — colours run to 200+
 * characters (several colours listed in one field).
 */
import { MAX_LISTING_PHOTOS } from "./listingPhotos.js";

export const MAX_IMAGES = MAX_LISTING_PHOTOS;
const MAX_PRICE = 100_000_000;
const SERVICE_AVAILABILITY = ["on_contact", "specific_time"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const fail = (error) => ({ ok: false, error });

function text(value, max) {
  if (value == null) return "";
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : null;
}

function longText(value, max) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length <= max ? clean : null;
}

function amount(value) {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= MAX_PRICE ? number : null;
}

/**
 * A listing photo must be one of OUR Cloudinary uploads — never an arbitrary
 * address (a tracking pixel, someone else's image, a private KYC photo).
 */
export function isListingImageUrl(url, cloudNames) {
  if (typeof url !== "string" || url.length > 500 || /[\s?#]/.test(url)) return false;
  return [cloudNames].flat().some((cloudName) => {
    const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
    if (!cloudName || !url.startsWith(prefix)) return false;
    const rest = url.slice(prefix.length);
    return rest.length > 0 && !rest.includes("..") && !rest.includes("//");
  });
}

function images(value, cloudNames) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_IMAGES) return null;
  if (!value.every((url) => isListingImageUrl(url, cloudNames))) return null;
  return new Set(value).size === value.length ? [...value] : null;
}

/**
 * @param {"product"|"service"} type
 * @param {object} input        what the caller sent
 * @param {{ cloudName: string|string[] }} options  our Cloudinary account(s)
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function validateListingInput(type, input, { cloudName }) {
  if (type !== "product" && type !== "service") return fail("Unknown listing type.");
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("Missing listing details.");

  const name = text(input.name, 150);
  if (!name) return fail("Give your listing a name (up to 150 characters).");
  const categoryId = text(input.categoryId, 80);
  if (!categoryId) return fail("Choose a category.");
  const description = longText(input.description, 5000);
  if (!description) return fail("Add a description (up to 5,000 characters).");
  const price = amount(input.price);
  if (price === null) return fail("Enter a valid price.");
  const photos = images(input.images, cloudName);
  if (Array.isArray(input.images) && input.images.length > MAX_IMAGES) {
    return fail(`A listing can have up to ${MAX_IMAGES} photos. Remove some and try again.`);
  }
  if (!photos) return fail(`Add between 1 and ${MAX_IMAGES} photos uploaded through TrybeMarket.`);

  if (type === "service") {
    const availabilityType = input.availability?.type;
    if (!SERVICE_AVAILABILITY.includes(availabilityType)) return fail("Choose when you're available.");
    const availability = { type: availabilityType };
    if (availabilityType === "specific_time") {
      const { start, end } = input.availability;
      if (!TIME.test(start) || !TIME.test(end) || end <= start) return fail("Enter a start time and a later end time.");
      availability.start = start;
      availability.end = end;
    }
    return { ok: true, data: { name, categoryId, description, price, availability, images: photos } };
  }

  // A list from today's form; older listings kept it as one piece of text, or empty.
  const given = input.subcategory ?? [];
  const subcategory = typeof given === "string" ? (given.trim() ? [given] : []) : given;
  if (!Array.isArray(subcategory) || subcategory.length > 10) return fail("Choose up to 10 subcategories.");
  const subcategories = subcategory.map((item) => text(item, 80));
  if (subcategories.some((item) => !item)) return fail("One of the subcategories isn't valid.");

  const brand = text(input.brand, 150);
  const condition = text(input.condition, 80);
  const color = text(input.color, 300); // sellers often list several colours
  const year = text(input.year, 40);
  if ([brand, condition, color, year].includes(null)) return fail("One of the details is too long.");

  // The form stores "" when there's no "was" price.
  const originalPrice = input.originalPrice === "" || input.originalPrice == null ? "" : amount(input.originalPrice);
  if (originalPrice === null) return fail("Enter a valid original price, or leave it empty.");

  return {
    ok: true,
    data: {
      name,
      subcategory: subcategories,
      categoryId,
      negotiable: input.negotiable === true,
      description,
      brand,
      condition,
      color,
      price,
      originalPrice,
      year,
      images: photos,
    },
  };
}
