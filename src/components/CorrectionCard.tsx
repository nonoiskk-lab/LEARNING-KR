import type { Correction } from "@/lib/ai/schema";

const CAT: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  structure: "Sentence structure",
  naturalness: "Sound natural",
  word_choice: "Word choice",
  fluency: "Fluency",
};

export default function CorrectionCard({ c, onPractice }: { c: Correction; onPractice?: (text: string) => void }) {
  return (
    <div className="rise rounded-2xl border border-line bg-panel-2/70 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="chip !py-0.5 !text-xs">{CAT[c.category] ?? c.category}</span>
        {onPractice && (
          <button className="text-xs font-semibold text-brand hover:underline" onClick={() => onPractice(c.moreNatural || c.better)}>
            🔁 Say it again
          </button>
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="label pt-0.5">You said</dt>
        <dd className="text-muted line-through decoration-bad/60">{c.youSaid}</dd>
        <dt className="label pt-0.5">Better</dt>
        <dd>{c.better}</dd>
        {c.moreNatural && c.moreNatural !== c.better && (
          <>
            <dt className="label pt-0.5">Natural</dt>
            <dd className="font-medium text-good">{c.moreNatural}</dd>
          </>
        )}
        <dt className="label pt-0.5">Why</dt>
        <dd className="text-muted">{c.why}</dd>
      </dl>
    </div>
  );
}
