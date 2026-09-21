import { ShieldCheck } from "lucide-react";

const DEFAULT_TIPS = [
  "Meet in a busy, public spot on campus.",
  "Check the item before you pay.",
  "Keep chatting inside TrybeMarket.",
];

/** The yellow "stay safe" card shared by the product and service pages. */
export default function SafetyNote({ tips = DEFAULT_TIPS }) {
  return (
    <section className="rounded-2xl border border-brand-yellow/60 bg-brand-yellow-soft p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <ShieldCheck className="h-4 w-4 text-amber-600" /> Stay safe on campus
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </section>
  );
}
