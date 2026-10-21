/**
 * Right-sized Cloudinary images. Listing photos are stored at whatever size
 * the seller uploaded (up to a 12-megapixel phone photo), and next.config's
 * `images.unoptimized` means Next doesn't resize them — so a feed of cards
 * shown at ~270px wide was downloading ~10 MB and decoding ~67 megapixels,
 * enough to make scrolling stutter or flash on a laptop.
 *
 * Cloudinary resizes on the fly when a transformation is put in the URL:
 *   …/image/upload/v123/folder/id.jpg
 *   …/image/upload/c_fill,w_600,h_450,q_auto,f_auto/v123/folder/id.jpg
 * q_auto picks a sensible quality and f_auto a modern format (WebP/AVIF) the
 * browser supports. Each size is generated once and then served from
 * Cloudinary's CDN.
 *
 * Anything that isn't a public Cloudinary upload URL (local files, other
 * hosts, signed or private delivery URLs) is returned unchanged.
 */

const MARKER = "/image/upload/";

/**
 * The sizes in use, about twice the displayed size for sharp screens. Cards
 * and thumbnails are cropped to their shape (c_fill, centred) — exactly what
 * their `object-cover` shows anyway, so a tall photo isn't decoded at full
 * height just to have most of it hidden. The listing page keeps the whole
 * photo (c_limit only shrinks).
 */
export const IMAGE_SIZES = {
  thumb: "c_fill,w_160,h_160", // 44–64px square thumbnails
  card: "c_fill,w_600,h_450", // 4:3 grid cards (~180–300px wide)
  full: "c_limit,w_1200", // the listing page's main photo
  zoom: "c_limit,w_2000", // the full-screen photo viewer
};

// One transformation step, e.g. "q_auto,f_auto,w_1200" — every comma-part is
// a short parameter name, an underscore and a value.
const TRANSFORMATION = /^[a-z]{1,3}_[^,/]+(,[a-z]{1,3}_[^,/]+)*$/;

/** `size` is a key of IMAGE_SIZES. */
export function cloudinaryImage(url, size) {
  if (typeof url !== "string" || !url.startsWith("https://res.cloudinary.com/")) return url;
  const at = url.indexOf(MARKER);
  if (at === -1) return url;
  const segments = url.slice(at + MARKER.length).split("/");
  // A signed delivery URL (s--…--): changing it would break the signature.
  if (segments[0].startsWith("s--")) return url;
  // Steps run left to right, so ours goes AFTER any the URL already has —
  // newer uploads are stored with "q_auto,f_auto,w_1200/", which would
  // otherwise scale our smaller size straight back up.
  let i = 0;
  while (i < segments.length - 1 && !/^v\d+$/.test(segments[i]) && TRANSFORMATION.test(segments[i])) i++;
  segments.splice(i, 0, `${IMAGE_SIZES[size]},q_auto,f_auto`);
  return url.slice(0, at + MARKER.length) + segments.join("/");
}
