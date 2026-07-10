"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CopyButton from "./CopyButton";
import type { Dict, Locale } from "@/lib/i18n";

// 프롬프트 라이브러리 — 무설치 진입층. claude.ai 채팅에 그대로 붙여넣는 복붙 프롬프트.
// 카테고리 칩 필터(클라이언트) + 프롬프트 카드(제목·설명·본문 mono) + 복사(퍼널 추적) + 자동화 업셀.
// 본문/제목/설명 언어: locale==="ko"면 ko, 아니면 en. UI가 ko·en이 아니면 en 콘텐츠 + 작은 "EN" 칩(정직 라벨).
// 카테고리·설치명은 콘텐츠 분류라 원문 유지, UI 크롬만 dict로 번역.

type Bi = { ko: string; en: string };
export type PromptEntry = {
  id: string;
  category: string;
  title: Bi;
  desc: Bi;
  body: Bi;
  relatedSkill?: string;
};

// 확정 15개 카테고리(데이터 taxonomy와 동일 순서). 칩 표시 순서이기도 하다.
const CATEGORY_ORDER = [
  "콘텐츠",
  "마케팅",
  "블로그",
  "유튜브",
  "개발",
  "디자인",
  "사업계획",
  "문서작성",
  "회의",
  "번역",
  "SNS",
  "Claude Code",
  "Cursor",
  "MCP",
  "자동화",
] as const;

// 비-ko 로케일 칩 라벨(콘텐츠와 동일하게 en으로). 고유명사는 그대로. 번역 볼륨을 늘리지 않으면서
// ko 외 사용자에게도 칩이 읽히게 한다(ko/en 콘텐츠 분리 규칙과 일치).
const CAT_EN: Record<string, string> = {
  콘텐츠: "Content",
  마케팅: "Marketing",
  블로그: "Blog",
  유튜브: "YouTube",
  개발: "Dev",
  디자인: "Design",
  사업계획: "Business",
  문서작성: "Docs",
  회의: "Meetings",
  번역: "Translation",
  SNS: "Social",
  "Claude Code": "Claude Code",
  Cursor: "Cursor",
  MCP: "MCP",
  자동화: "Automation",
};

const ACCENT = "#e8702a";
const ALL = "__ALL__";

export default function PromptLibrary({
  prompts,
  dict,
  locale,
}: {
  prompts: PromptEntry[];
  dict: Dict;
  locale: Locale;
}) {
  const [activeCat, setActiveCat] = useState<string>(ALL);

  const contentLocale: "ko" | "en" = locale === "ko" ? "ko" : "en";
  const showEnChip = locale !== "ko" && locale !== "en";
  const catLabel = (c: string) => (locale === "ko" ? c : CAT_EN[c] ?? c);

  // 데이터에 실제로 존재하는 카테고리만, 확정 순서로.
  const chips = useMemo(() => {
    const present = new Set(prompts.map((p) => p.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [prompts]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prompts) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [prompts]);

  const shown = useMemo(
    () => (activeCat === ALL ? prompts : prompts.filter((p) => p.category === activeCat)),
    [prompts, activeCat],
  );

  return (
    <div>
      {/* 카테고리 칩 필터 */}
      <nav aria-label={dict.prompts.filterAria} className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCat(ALL)}
          aria-pressed={activeCat === ALL}
          className="rounded-full border-[1.5px] px-3 py-1 font-mono text-xs transition-colors"
          style={
            activeCat === ALL
              ? { background: ACCENT, borderColor: ACCENT, color: "#fff" }
              : { borderColor: "var(--line-strong)", color: "var(--ink-soft)" }
          }
        >
          {dict.prompts.filterAll} ({prompts.length})
        </button>
        {chips.map((c) => {
          const on = activeCat === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCat(on ? ALL : c)}
              aria-pressed={on}
              className="rounded-full border-[1.5px] px-3 py-1 font-mono text-xs transition-colors"
              style={
                on
                  ? { background: ACCENT, borderColor: ACCENT, color: "#fff" }
                  : { borderColor: "var(--line-strong)", color: "var(--ink-soft)" }
              }
            >
              {catLabel(c)} ({counts.get(c)})
            </button>
          );
        })}
      </nav>

      {/* EN 콘텐츠 고지 — UI가 ko·en이 아닐 때만(정직 라벨). */}
      {showEnChip && (
        <p className="mb-5 flex items-center gap-2 font-mono text-xs text-[var(--ink-faint)]">
          <span className="inline-block rounded border border-[var(--line-strong)] bg-[var(--paper-2)] px-1.5 py-0.5">
            EN
          </span>
          {dict.prompts.enNote}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id} className="paper-card flex flex-col rounded-lg px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-lg font-semibold text-ink">{p.title[contentLocale]}</h3>
              <span className="shrink-0 rounded-full bg-[var(--paper-2)] px-2 py-0.5 font-mono text-xs text-[var(--ink-soft)]">
                {catLabel(p.category)}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{p.desc[contentLocale]}</p>

            {/* 프롬프트 본문 — mono 블록, 줄바꿈 유지. 원문 언어(ko/en) 그대로. */}
            <pre
              lang={contentLocale}
              className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-3 font-mono text-[13px] leading-relaxed text-ink"
            >
              {p.body[contentLocale]}
            </pre>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <CopyButton
                text={p.body[contentLocale]}
                label={dict.scanner.copy}
                copiedLabel={dict.scanner.copied}
                className="!px-3 !py-1.5 !text-xs"
                track={{ event: "prompt_copy", name: p.id }}
              />
              {/* 자동화 업셀 — relatedSkill이 있을 때만, 검증된 카탈로그 스킬로 유도. */}
              {p.relatedSkill && (
                <Link
                  href={`/${locale}/catalog?q=${encodeURIComponent(p.relatedSkill)}`}
                  className="font-mono text-xs text-[var(--accent)] underline transition-opacity hover:opacity-70"
                >
                  {dict.prompts.upsell} {p.relatedSkill} ↗
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
