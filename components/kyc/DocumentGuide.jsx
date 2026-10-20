"use client";

import { Info } from "lucide-react";

/**
 * "How to take this photo" for each KYC document, shown before the upload.
 *
 * Mock images (fake data only — never a real student's name, photo or number)
 * go in GUIDE_IMAGES once they're designed; until then the steps stand alone.
 * Keep them as uploaded assets so they're easy to replace if the portal changes.
 */
const GUIDE_IMAGES = {
  student_id: [],
  portal_screenshot: [], // e.g. { src: "/kyc-guides/portal-android.png", alt: "…" }, { src: "…-iphone.png", … }
  library_card: [], // front and back mock-ups
};

const GUIDES = {
  student_id: {
    title: "Photographing your student ID",
    steps: [
      "Lay the card flat on a plain surface, in good light.",
      "Keep all four corners in the photo, with no glare on the text.",
      "Take the front and the back as two separate photos.",
    ],
  },
  portal_screenshot: {
    title: "Taking your portal screenshot",
    steps: [
      "Log in at portal.lcu.edu.ng.",
      "Open the Student Dashboard — the first page after you log in.",
      "Take a screenshot of the whole screen. Don't crop it, and keep the address bar (portal.lcu.edu.ng) visible — it's at the top in Chrome on Android and at the bottom in Safari on iPhone.",
      "Make sure your Name, Matriculation Number, Level and the session line are all on screen.",
      "Upload that screenshot below.",
    ],
    note: "The screenshot also shows your fees. We only read your name, matriculation number, level and session.",
  },
  library_card: {
    title: "Photographing your library card",
    steps: [
      "Lay the card flat on a plain surface, in good light, with no glare.",
      "Front: \"Lead City University\", \"University Librarian\" and your Card No must be readable.",
      "Back: the printed line \"This card remains the property of…\", your Surname and Year of Entry must be readable.",
      "Keep all four corners in each photo, and take the front and back as two separate photos.",
    ],
  },
};

export default function DocumentGuide({ documentType }) {
  const guide = GUIDES[documentType];
  if (!guide) return null;
  const images = GUIDE_IMAGES[documentType] || [];
  return (
    <details className="group rounded-2xl border border-blue-100 bg-blue-50/60 p-4" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900">
        <Info className="h-4 w-4 shrink-0 text-primary" />
        {guide.title}
      </summary>
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {images.map((image) => (
            <img key={image.src} src={image.src} alt={image.alt} className="w-full rounded-xl border border-slate-200" />
          ))}
        </div>
      )}
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {guide.note && <p className="mt-3 text-xs text-slate-500">{guide.note}</p>}
    </details>
  );
}
