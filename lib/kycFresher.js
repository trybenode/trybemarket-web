/**
 * Reading fresher documents (100 and 200 level students without an ID card
 * yet) — pure, no I/O, so it can be tested against fixtures.
 *
 *   - Portal screenshot (portal.lcu.edu.ng Student Dashboard): printed,
 *     labelled fields. Read by LABEL — the value after "Name:", the digits
 *     after "Matriculation Number", the value after "Level:" — never by
 *     searching the whole text for what the student typed.
 *   - Library card: printed markers show it's a real Lead City library card;
 *     the handwritten Surname and Year of Entry are read as HINTS for the
 *     admin only (handwriting OCR is unreliable). It has no matric number,
 *     and its Card No is never treated as one.
 *
 * Nothing here rejects a student on its own: a missing marker, an unreadable
 * field or a format we haven't seen goes to an admin. The only automatic
 * "not eligible" is a portal screenshot that clearly says 300 level or above.
 */
import { words, nameWords } from "./kycText.js";

/** A temporary (fresher) matric number: exactly 7 digits, e.g. 2501164. */
export const TEMP_MATRIC_PATTERN = /^\d{7}$/;
/** A library Card No as typed by the student (5 digits on the cards seen; allow 3–8). */
export const LIBRARY_CARD_PATTERN = /^\d{3,8}$/;

const LEAD_CITY = /lead\s*city\s*universit/i;

function lines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The value for a label: the rest of the label's line, or — when OCR put the
 * value on its own line — the next line. `label` must match from the start of
 * a line and capture what follows.
 */
function labelValue(textLines, label) {
  for (let i = 0; i < textLines.length; i++) {
    const match = label.exec(textLines[i]);
    if (!match) continue;
    const rest = (match[1] || "").replace(/^[\s:.\-]+/, "").trim();
    if (rest) return rest;
    return textLines[i + 1] ?? null;
  }
  return null;
}

/** "2025/2026" from text like "2025/2026 Session - First Semester", or null. */
function readSession(text) {
  const match = /(\d{4})\s*\/\s*(\d{4})\s*session/i.exec(String(text ?? ""));
  return match ? `${match[1]}/${match[2]}` : null;
}

/** Start year of a session string like "2026/2027". */
function sessionStartYear(session) {
  const match = /^(\d{4})\s*\/\s*\d{4}$/.exec(String(session ?? "").trim());
  return match ? Number(match[1]) : null;
}

/**
 * Fields from a portal Student Dashboard screenshot.
 *
 * @returns {{ name: string|null, matric: string|null, matricRaw: string|null, level: number|null,
 *   session: string|null, institutionFound: boolean, portalHostFound: boolean }}
 */
export function parsePortalText(text) {
  const textLines = lines(text);
  const name = labelValue(textLines, /^name\b(.*)$/i);
  const matricRaw = labelValue(textLines, /^matric(?:ulation)?\s*(?:number|no\.?)\b(.*)$/i);
  const matricDigits = matricRaw ? matricRaw.replace(/\s+/g, "").match(/^\d+/)?.[0] ?? null : null;
  const levelRaw = labelValue(textLines, /^level\b(.*)$/i);
  const levelMatch = levelRaw ? /^(\d{3})\b/.exec(levelRaw.trim()) : null;

  return {
    name: name ? name.replace(/\s+/g, " ").trim() : null,
    matric: matricDigits && TEMP_MATRIC_PATTERN.test(matricDigits) ? matricDigits : null,
    matricRaw,
    level: levelMatch ? Number(levelMatch[1]) : null,
    session: readSession(text),
    institutionFound: LEAD_CITY.test(String(text ?? "")),
    portalHostFound: /portal\.lcu\.edu\.ng/i.test(String(text ?? "")),
  };
}

/**
 * Markers and handwriting hints from a library card's two sides.
 *
 * @returns {{ frontMarkers: { leadCity: boolean, librarian: boolean },
 *   backMarkers: { property: boolean }, surname: string|null, otherNames: string|null,
 *   yearOfEntry: string|null }}
 */
export function parseLibraryCard(frontText, backText) {
  const back = String(backText ?? "");
  const backLines = lines(backText);
  const year = /year\s*of\s*entry\s*[:.\-]?\s*(\d{4})\s*(?:[\/\-]\s*(\d{4}))?/i.exec(back);
  return {
    frontMarkers: {
      leadCity: LEAD_CITY.test(String(frontText ?? "")),
      librarian: /university\s*librarian/i.test(String(frontText ?? "")),
    },
    backMarkers: {
      property: /remains\s*the\s*property\s*of/i.test(back) && /lead\s*city\s*university\s*library/i.test(back),
    },
    surname: labelValue(backLines, /^sur\s*name\b(.*)$/i),
    otherNames: labelValue(backLines, /^other\s*names?\b(.*)$/i),
    yearOfEntry: year ? (year[2] ? `${year[1]}/${year[2]}` : year[1]) : null,
  };
}

/**
 * How many of the typed name's words appear in a name read from a document —
 * whole words, any order (the portal shows SURNAME first).
 */
export function countNameMatches(typedName, documentName) {
  const documentWords = new Set(words(documentName));
  return [...new Set(nameWords(typedName))].filter((w) => documentWords.has(w)).length;
}

/**
 * Eligibility for the fresher route (100 or 200 level in the current session).
 *
 *   portal:  from the Level field — 100/200 eligible, 300+ not eligible,
 *            unreadable → unknown (an admin decides).
 *   library: from the handwritten Year of Entry — a HINT only, never a
 *            rejection: entering in the current session = 100 level, the
 *            session before = 200 level.
 *
 * @returns {{ eligible: boolean|null, derivedLevel: number|null, entryYear: string|null,
 *   sessionMatches: boolean|null, source: "portal"|"library" }}
 */
export function deriveEligibility(input, { currentSession }) {
  const currentStart = sessionStartYear(currentSession);
  if (input.source === "portal") {
    const level = input.level ?? null;
    return {
      source: "portal",
      derivedLevel: level,
      entryYear: null,
      eligible: level === null ? null : level === 100 || level === 200,
      sessionMatches: input.session ? input.session === currentSession : null,
    };
  }
  const entryStart = input.yearOfEntry ? Number(String(input.yearOfEntry).slice(0, 4)) : null;
  const derivedLevel =
    entryStart && currentStart && entryStart <= currentStart ? (currentStart - entryStart + 1) * 100 : null;
  return {
    source: "library",
    derivedLevel,
    entryYear: input.yearOfEntry ?? null,
    eligible: derivedLevel === null ? null : derivedLevel === 100 || derivedLevel === 200,
    sessionMatches: null,
  };
}

/**
 * Every check a portal screenshot must pass to be approved automatically (when
 * auto-pass is switched on). Anything false or unknown sends it to an admin.
 */
export function evaluatePortal(parsed, { fullName, tempMatric }, config) {
  const eligibility = deriveEligibility({ source: "portal", level: parsed.level, session: parsed.session }, config);
  const checks = {
    nameMatched: countNameMatches(fullName, parsed.name),
    nameWords: [...new Set(nameWords(fullName))].length,
    numberMatches: !!parsed.matric && parsed.matric === tempMatric,
    institutionFound: parsed.institutionFound,
    levelEligible: eligibility.eligible === true,
    sessionMatches: eligibility.sessionMatches === true,
    portalHostFound: parsed.portalHostFound,
  };
  const pass =
    checks.nameMatched >= 2 &&
    checks.numberMatches &&
    checks.institutionFound &&
    checks.levelEligible &&
    checks.sessionMatches &&
    checks.portalHostFound;
  return { pass, checks, eligibility };
}
