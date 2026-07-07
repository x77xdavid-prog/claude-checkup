import CopyButton from "./CopyButton";
import { recsFor, type Rec } from "@/lib/recommendations";

// 카테고리 추천 렌더 — 데모 진단서와 실제 결과 페이지가 공유(DRY).
// 서버 컴포넌트: 명령 문자열이 SSR HTML에 그대로 들어가야(게이트: grep "insane-search").
// type=builtin → 내장 뱃지, install → CopyButton. 명령은 항상 화면에 <code>로 표시.

export default function SkillRecs({ categoryKey, n = 2 }: { categoryKey: string; n?: number }) {
  const recs = recsFor(categoryKey, n);
  if (recs.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {recs.map((r) => (
        <RecRow key={r.name} rec={r} />
      ))}
    </ul>
  );
}

function RecRow({ rec }: { rec: Rec }) {
  const isBuiltin = rec.type === "builtin";
  return (
    <li className="rounded-lg border border-[var(--line)] bg-[var(--paper-2)] px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-ink">{rec.name}</span>
        {isBuiltin ? (
          <span
            className="rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
            style={{ background: "var(--c-good-bg)", color: "var(--c-good)" }}
          >
            Claude Code 내장 — 설치 불필요
          </span>
        ) : (
          <span
            className="rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
            style={{ background: "var(--c-gap-bg)", color: "var(--accent-ink)" }}
          >
            설치
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{rec.tip}</p>
      <div className="mt-2 flex items-start justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
        <code className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-ink">
          {rec.command}
        </code>
        <CopyButton text={rec.command} label="복사" className="shrink-0" />
      </div>
    </li>
  );
}
