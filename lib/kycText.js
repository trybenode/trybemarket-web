/**
 * Pure text checks for KYC — no Firebase, no I/O — so they can be tested
 * against fixtures. Used by lib/kycServer.js (ID cards) and lib/kycFresher.js
 * (portal screenshots and library cards).
 */

// A matric number this short/long after normalizing is never a real one — and
// an empty normalized string would make the OCR "includes" check match
// anything, so callers must reject these before any OCR work happens.
const MIN_NORMALIZED_MATRIC_LENGTH = 4;
const MAX_NORMALIZED_MATRIC_LENGTH = 40;

export function normalizeMatric(str) {
  return String(str).toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
}

export function isValidNormalizedMatric(normalized) {
  return (
    normalized.length >= MIN_NORMALIZED_MATRIC_LENGTH &&
    normalized.length <= MAX_NORMALIZED_MATRIC_LENGTH
  );
}

/**
 * Stricter check for a matric number a STUDENT types (admins approving by hand
 * still use isValidNormalizedMatric). Formats differ by school — LCU/UG/25/35669,
 * EAUED1234567, FUO/22/1234 — but every real one has a run of digits, while
 * junk seen in past requests ("HFHCHG", "LCUCJVD") has none.
 */
export function isPlausibleMatric(raw) {
  const normalized = normalizeMatric(raw ?? "");
  const digits = (normalized.match(/[0-9]/g) || []).length;
  return normalized.length >= 5 && normalized.length <= MAX_NORMALIZED_MATRIC_LENGTH && digits >= 4;
}

// Lowercased, accent-stripped words of at least two letters/digits.
export function words(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** The words of a typed full name the ID check matches on (initials dropped). */
export function nameWords(fullName) {
  return words(fullName).filter((w) => /\p{L}/u.test(w));
}

// Words that mark text as coming from an institution's document. A speed bump
// for a plain handwritten note carrying just a name and matric number — not a
// real defence; that's the liveness check's job (next task).
const INSTITUTION_WORDS = ["university", "polytechnic", "college", "institute", "school"];
// Too common in school names to identify one.
const GENERIC_SCHOOL_WORDS = new Set([
  ...INSTITUTION_WORDS, "of", "the", "and", "for", "state", "federal", "technology",
  "education", "science", "sciences", "agriculture",
]);

/**
 * Decides whether OCR text from a student's ID supports what they typed.
 * Pure — no I/O — so it can be checked against fixtures.
 *
 * - Name: at least two typed name words appear as whole OCR words. A word of
 *   4+ letters may also sit inside a longer OCR word, since OCR often merges
 *   neighbours ("SURNAMEKUTI"). The old check matched substrings of the whole
 *   text, so "ade" matched inside "grade".
 * - Matric: the normalized matric appears in the normalized text.
 * - Institution: a school word ("university", …) or a distinctive word of the
 *   student's own school ("lead", "city", "ibadan") appears.
 *
 * @returns {{ pass: boolean, nameMatched: number, nameWords: number, matricFound: boolean, institutionFound: boolean }}
 */
export function evaluateIdText(text, { fullName, matricNumber, university }) {
  const tokens = words(text);
  const tokenSet = new Set(tokens);
  const has = (w) => tokenSet.has(w) || (w.length >= 4 && tokens.some((t) => t.length > w.length && t.includes(w)));

  const typedName = [...new Set(nameWords(fullName))];
  const nameMatched = typedName.filter(has).length;

  const normalizedMatric = normalizeMatric(matricNumber ?? "");
  const matricFound = normalizedMatric.length > 0 && normalizeMatric(text ?? "").includes(normalizedMatric);

  const schoolWords = words(university).filter((w) => w.length >= 4 && !GENERIC_SCHOOL_WORDS.has(w));
  const institutionFound = INSTITUTION_WORDS.some(has) || schoolWords.some(has);

  return {
    pass: nameMatched >= 2 && matricFound && institutionFound,
    nameMatched,
    nameWords: typedName.length,
    matricFound,
    institutionFound,
  };
}
