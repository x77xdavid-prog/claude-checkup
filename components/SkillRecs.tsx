import CopyButton from "./CopyButton";
import type { Dict } from "@/lib/i18n";
import { localizedRecs, type LocalizedRec } from "@/lib/i18n-helpers";

// 카테고리 추천 렌더 — 데모 진단서와 실제 결과 페이지가 공유(DRY).
// 서버 컴포넌트: 명령 문자열이 SSR HTML에 그대로 들어가야(게이트: grep "insane-search").
// name/tip/뱃지는 사전 번역, command는 원문 유지(복사·검증 대상).
export default function SkillRecs({ categoryKey, dict, n = 2 }: { categoryKey: string; dict: Dict; n?: number }) {
  const recs = localizedRecs(dict, categoryKey, n);
  if (recs.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {recs.map((r) => (
        <RecRow key={r.name} rec={r} dict={dict} />
      ))}
    </ul>
  );
}

function RecRow({ rec, dict }: { rec: LocalizedRec; dict: Dict }) {
  const isBuiltin = rec.type === "builtin";
  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--paper-2)] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{rec.displayName}</span>
        {isBuiltin ? (
          <span
            className="rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
            style={{ background: "var(--c-good-bg)", color: "var(--c-good)" }}
          >
            {dict.recBadge.builtin}
          </span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
            style={{ background: "var(--c-gap-bg)", color: "var(--accent-ink)" }}
          >
            {dict.recBadge.install}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{rec.displayTip}</p>
      <div className="mt-2 flex items-start justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
        <code className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink">
          {rec.command}
        </code>
        <CopyButton text={rec.command} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0" />
      </div>
    </li>
  );
}
