"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import type { Dict } from "@/lib/i18n";
import { catCatLabel } from "@/lib/i18n-helpers";
import type { InstallKind } from "@/lib/install-command";
import { TIER, isTierKind, type SkillItem } from "./catalog-shared";

// 스킬 카드 v2(시안 B) — CatalogBrowser에서 분리(800줄 규칙 대비).
// 상단 row: 카테고리 pill(모노·괘선 테두리) + 검증 배지 우측 / 이름 모노 bold / 설명 2줄 클램프
// (line-clamp는 CSS만 — DOM에는 전문 유지 → 초기 그룹 뷰의 SEO 텍스트 보존).
// 하단 row: 점선 상단 괘선 + 좌 설치수(topInstalls에 있을 때만) + 우 예시 프롬프트 토글.
// 기존 기능(설치 명령 복사·샘플 프롬프트·출처 링크·대안 추천) 전부 보존.

// 검증 단계 배지(카드·범례 공유). 알 수 없는 kind면 렌더 안 함(호출부에서 tier null 가드).
export function TierBadge({ kind, dict }: { kind: InstallKind; dict: Dict }) {
  const t = TIER[kind];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs ${t.cls}`}>
      <span aria-hidden>{t.glyph}</span>
      {dict.catalog[t.labelKey]}
    </span>
  );
}

// 컬렉션 배지 아이콘 — 이모지 금지 규칙에 따라 인라인 SVG(상자).
function BoxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 8v8l-9 5-9-5V8l9-5 9 5Z" />
      <path d="m3.3 7.3 8.7 4.8 8.7-4.8" />
      <path d="M12 22v-9" />
    </svg>
  );
}

// 예시 프롬프트 토글 — 첫 펼침 때만 API 1회 fetch, 이후 상태 캐시(재fetch 없음).
// 프롬프트 원문은 한국어 유지(lang="ko"). 각 줄에 복사 버튼(CopyButton 재사용).
// 카드 v2에서는 하단 row(점선 괘선)에 통합 — leftSlot(설치수)을 같은 행 좌측에 받는다.
type PromptState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; prompts: string[] }
  | { status: "error" };

function SamplePrompts({ name, dict, leftSlot }: { name: string; dict: Dict; leftSlot?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PromptState>({ status: "idle" });

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || state.status !== "idle") return; // 접거나 이미 로드했으면 fetch 스킵
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/sample-prompts/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { prompts?: unknown };
      const prompts = Array.isArray(data.prompts)
        ? data.prompts.filter((p): p is string => typeof p === "string")
        : [];
      setState({ status: "done", prompts });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <div className="mt-auto pt-4">
      <div className="border-t border-dotted border-[var(--line-strong)] pt-3">
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span>{leftSlot}</span>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex items-center gap-1.5 font-mono text-xs text-[var(--accent)] transition-colors hover:underline"
          >
            <span aria-hidden>{open ? "▾" : "▸"}</span>
            {open ? dict.catalog.samplePromptsHide : dict.catalog.samplePrompts}
          </button>
        </div>
        {open && (
          <div className="mt-3">
            {state.status === "loading" && (
              <p className="font-mono text-xs text-[var(--ink-faint)]" role="status">
                …
              </p>
            )}
            {state.status === "error" && (
              <p className="font-mono text-xs text-[var(--ink-faint)]" role="status">
                {dict.catalog.samplePromptsError}
              </p>
            )}
            {state.status === "done" && state.prompts.length > 0 && (
              <>
                <p className="mb-2 font-mono text-xs text-[var(--ink-faint)]">
                  {dict.catalog.samplePromptsHint} · {dict.catalog.samplePromptsLang}
                </p>
                <ul className="flex flex-col gap-2">
                  {state.prompts.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 rounded-md border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2"
                    >
                      {/* 프롬프트 원문 = 한국어(번역 안 함) */}
                      <span lang="ko" className="flex-1 text-sm leading-relaxed text-[var(--ink-soft)]">
                        {p}
                      </span>
                      <CopyButton
                        text={p}
                        label={dict.scanner.copy}
                        copiedLabel={dict.scanner.copied}
                        className="shrink-0 !px-2 !py-1 !text-xs"
                        track={{ event: "prompt_copy", name }}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 설치 블록 — install2(정직 원칙) 기반. marketplace/verified-repo면 실제 명령+복사,
// unverified면 회색 배지+대안 링크. install2 없으면(레거시/미조인) 가짜 로컬 안내는 숨김.
function InstallBlock({ s, dict, onPick }: { s: SkillItem; dict: Dict; onPick?: (q: string) => void }) {
  const i2 = s.install2;

  // 폴백: install2 미조인 상태. 가짜 "SKILL.md 복사" 안내는 표시하지 않음(정직 원칙).
  if (!i2) {
    if (!s.install || s.install.includes("SKILL.md")) return null;
    return (
      <div className="mt-4 flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
        <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{s.install}</code>
        <CopyButton text={s.install} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0 !px-2 !py-1 !text-xs" track={{ event: "install_copy", name: s.name }} />
      </div>
    );
  }

  // marketplace / verified-repo — 실제 명령 + 복사 버튼.
  if (i2.command !== null) {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
          <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{i2.command}</code>
          <CopyButton text={i2.command} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0 self-start !px-2 !py-1 !text-xs" track={{ event: "install_copy", name: s.name }} />
        </div>
        {(i2.license || i2.note) && (
          <p className="mt-1.5 font-mono text-xs text-[var(--ink-faint)]">
            {i2.license && (
              <span>
                {dict.catalog.installLicense}: {i2.license}
              </span>
            )}
            {i2.license && i2.note && " · "}
            {i2.note}
          </p>
        )}
      </div>
    );
  }

  // unverified — 회색 배지 + 안내 + 대안 링크.
  return (
    <div className="mt-4 rounded-md border border-dashed border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2.5">
      <span className="inline-block rounded-full bg-[var(--line)] px-2 py-0.5 font-mono text-xs text-[var(--ink-soft)]">
        {dict.catalog.installUnverified}
      </span>
      <p className="mt-1.5 font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.installUnverifiedHint}</p>
      {i2.alternatives && i2.alternatives.length > 0 && onPick && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
          <span className="text-[var(--ink-faint)]">{dict.catalog.installAlt}:</span>
          {i2.alternatives.map((alt) => (
            <button
              key={alt}
              type="button"
              onClick={() => onPick(alt)}
              className="text-[var(--accent)] underline transition-opacity hover:opacity-70"
            >
              {alt}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}

export default function SkillCard({
  s,
  dict,
  onPick,
  installCount,
}: {
  s: SkillItem;
  dict: Dict;
  onPick?: (q: string) => void;
  installCount?: number; // funnel-stats topInstalls에 있을 때만 전달(없으면 표시 생략 — 정직)
}) {
  const tier = isTierKind(s.install2?.kind) ? s.install2!.kind : null;
  const sourceUrl = s.sourceUrl ?? null;
  // 표시용 슬러그(github.com/ 접두 제거). 정직: sourceUrl이 있을 때만 링크한다.
  const sourceSlug = sourceUrl
    ? sourceUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/^https?:\/\//i, "")
    : null;
  return (
    <li className="paper-card flex flex-col rounded-lg px-5 py-5 transition-[transform,border-color,box-shadow] duration-150 ease-out hover:border-[var(--accent-ink)] hover:shadow-[4px_4px_0_var(--line-strong)] motion-safe:hover:-translate-x-px motion-safe:hover:-translate-y-px">
      {/* 상단 row — 카테고리 pill(좌) + 검증 배지(우) */}
      {(s.category || tier) && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {s.category ? (
            <span className="rounded-full border border-[var(--line-strong)] px-2 py-0.5 font-mono text-xs text-[var(--ink-soft)]">
              {catCatLabel(dict, s.category)}
            </span>
          ) : (
            <span aria-hidden />
          )}
          {tier && <TierBadge kind={tier} dict={dict} />}
        </div>
      )}
      <h3 className="break-words font-mono text-base font-bold text-ink">{s.name}</h3>
      {/* description은 원문(영/한) 유지 — 번역하지 않음. 클램프는 CSS만(DOM에 전문 유지 = SEO). */}
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-soft)]">{s.description}</p>
      {/* 외부 컬렉션 배지 — 라벨 원문 유지, 아이콘은 인라인 SVG */}
      {s.collection && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--accent)] bg-[var(--paper-2)] px-2 py-0.5 font-mono text-xs text-[var(--accent)]">
          <BoxIcon />
          {s.collection}
        </span>
      )}
      {/* 정직 출처 링크 — sourceUrl 있을 때만(미검증은 링크할 확인된 출처 없음) */}
      {sourceUrl && (
        <p className="mt-2.5 font-mono text-xs text-[var(--ink-faint)]">
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="link-ink">
            {dict.catalog.sourceLink}: {sourceSlug} ↗
          </a>
          {" · "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline transition-opacity hover:opacity-70"
          >
            {dict.catalog.starRepo}
          </a>
        </p>
      )}
      <InstallBlock s={s} dict={dict} onPick={onPick} />
      {/* 하단 row — 점선 괘선 위 좌 설치수(있으면) / 우 예시 프롬프트 토글 */}
      <SamplePrompts
        name={s.name}
        dict={dict}
        leftSlot={
          typeof installCount === "number" ? (
            <span className="font-mono text-xs text-[var(--ink-soft)]">
              ↓ {installCount} {dict.catalog.installs}
            </span>
          ) : null
        }
      />
    </li>
  );
}
