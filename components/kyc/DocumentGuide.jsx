"use client";

import { useState } from "react";
import { Expand, X } from "lucide-react";

/**
 * "What a good photo looks like" for each KYC document: a small example (mock
 * images with FAKE data only — never a real student's name, photo or number)
 * with numbered callouts, and a short legend whose numbers match the image.
 * Tap the example to see it full size. The images live in public/kyc-guides/
 * so they're easy to replace if the portal or the card changes.
 */
const GUIDES = {
  portal_screenshot: {
    thumbFit: "object-cover object-top", // tall phone screenshot: show the top
    images: [{ src: "/kyc-guides/portal-example.png", alt: "Example portal Student Dashboard with fake data" }],
    legend: [
      "portal.lcu.edu.ng in the address bar",
      "Student Dashboard",
      "The session line",
      "Matriculation Number",
      "Your name",
      "Your level",
    ],
    tip: "Screenshot the whole screen — don't crop it.",
  },
  library_card: {
    thumbFit: "object-contain p-1", // wide card: show it whole
    images: [
      { src: "/kyc-guides/library-front-example.png", alt: "Example library card front with fake data" },
      { src: "/kyc-guides/library-back-example.png", alt: "Example library card back with fake data" },
    ],
    legend: [
      "Lead City University",
      "Card No",
      "University Librarian",
      "\"This card remains the property of…\"",
      "Surname",
      "Year of Entry",
    ],
    tip: "Lay the card flat in good light. Front and back as two photos.",
  },
  student_id: {
    images: [],
    legend: [],
    tip: "Lay the card flat in good light, all four corners in view, no glare. Front and back as two photos.",
  },
};

export default function DocumentGuide({ documentType }) {
  const [open, setOpen] = useState(false);
  const guide = GUIDES[documentType];
  if (!guide) return null;

  if (!guide.images.length) {
    return <p className="rounded-2xl bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-200/70">{guide.tip}</p>;
  }

  return (
    <>
      <div className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
          aria-label="See the example full size"
        >
          <img src={guide.images[0].src} alt="" className={`h-full w-full ${guide.thumbFit}`} />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/60 py-0.5 text-[10px] font-medium text-white">
            <Expand className="h-3 w-3" /> Example
          </span>
        </button>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">Make sure these are visible</p>
          <ol className="mt-1.5 space-y-0.5">
            {guide.legend.map((item, index) => (
              <li key={item} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="px-1 text-[11px] text-slate-500">{guide.tip}</p>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/90"
          role="dialog"
          aria-modal="true"
          aria-label="Example photo"
          onClick={() => setOpen(false)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6" onClick={(e) => e.stopPropagation()}>
            {guide.images.map((image) => (
              <img key={image.src} src={image.src} alt={image.alt} className="mx-auto w-full max-w-sm rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
