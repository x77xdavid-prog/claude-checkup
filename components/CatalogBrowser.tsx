"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_ORDER } from "@/lib/categories";
import { matchUsecaseIn, type Usecase } from "@/lib/usecases";
import CopyButton from "./CopyButton";
import type { Dict } from "@/lib/i18n";
import { catCatLabel } from "@/lib/i18n-helpers";
import type { Install2 } from "@/lib/install-command";

// 스킬 카탈로그 검색 + 카테고리 필터 + 설치 명령 복사.
// 데이터는 서버에서 initialItems로 주입(SEO: 초기 HTML에 569종 전부 포함).
// 스킬 description·install 명령은 원문 유지(번역 안 함). UI 크롬만 dict로 번역.
// 카테고리 칩/그룹 헤딩은 표시만 번역(내부 값은 한국어 카테고리 그대로 → 검색·필터 일관).
export interface SkillItem {
  name: string;
  description: string;
  install: string; // 레거시 설치 문자열 (없으면 빈 문자열) — install2로 대체됨
  category?: string;
  tags?: string[];
  source?: string; // "local" | "plugin:<마켓>"
  install2?: Install2; // 빌드 시 선계산된 정직 설치 결과
}

const ACCENT = "#e8702a";
const ALL = "__ALL__"; // 내부 sentinel(로케일 무관)

// 표시 순서대로 정렬된 [카테고리, 항목[]] 그룹. 데이터에 있는 카테고리만.
function groupByCategory(items: SkillItem[]): [string, SkillItem[]][] {
  const map = new Map<string, SkillItem[]>();
  for (const s of items) {
    const c = s.category || "기타";
    (map.get(c) ?? map.set(c, []).get(c)!).push(s);
  }
  const known = CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as [string, SkillItem[]]);
  const extras = [...map.keys()]
    .filter((c) => !CATEGORY_ORDER.includes(c as (typeof CATEGORY_ORDER)[number]))
    .sort()
    .map((c) => [c, map.get(c)!] as [string, SkillItem[]]);
  return [...known, ...extras];
}

// 예시 프롬프트 토글 — 첫 펼침 때만 API 1회 fetch, 이후 상태 캐시(재fetch 없음).
// 프롬프트 원문은 한국어 유지(lang="ko"). 각 줄에 복사 버튼(CopyButton 재사용).
type PromptState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; prompts: string[] }
  | { status: "error" };

function SamplePrompts({ name, dict }: { name: string; dict: Dict }) {
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
    <div className="mt-4 border-t border-[var(--line)] pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono text-xs text-[var(--accent)] transition-colors hover:underline"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        {open ? dict.catalog.samplePromptsHide : dict.catalog.samplePrompts}
      </button>
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
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
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
        <CopyButton text={s.install} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0 !px-2 !py-1 !text-xs" />
      </div>
    );
  }

  // marketplace / verified-repo — 실제 명령 + 복사 버튼.
  if (i2.command !== null) {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--line-strong)] bg-[var(--paper-2)] px-3 py-2">
          <code className="overflow-x-auto whitespace-pre font-mono text-xs text-ink">{i2.command}</code>
          <CopyButton text={i2.command} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0 self-start !px-2 !py-1 !text-xs" />
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

function SkillCard({ s, dict, onPick }: { s: SkillItem; dict: Dict; onPick?: (q: string) => void }) {
  return (
    <li className="paper-card flex flex-col rounded-lg px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg font-semibold text-ink">{s.name}</h3>
        {s.category && (
          <span className="shrink-0 rounded-full bg-[var(--paper-2)] px-2 py-0.5 font-mono text-xs text-[var(--ink-soft)]">
            {catCatLabel(dict, s.category)}
          </span>
        )}
      </div>
      {/* description은 원문(영/한) 유지 — 번역하지 않음 */}
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--ink-soft)]">{s.description}</p>
      <InstallBlock s={s} dict={dict} onPick={onPick} />
      <SamplePrompts name={s.name} dict={dict} />
    </li>
  );
}

export default function CatalogBrowser({
  initialItems,
  dict,
  usecases,
}: {
  initialItems: SkillItem[];
  dict: Dict;
  usecases: Usecase[];
}) {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string>(ALL); // ALL = 전체

  // 카테고리별 개수 — 칩 배지용(원본 전체 기준, 검색과 무관).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of initialItems) {
      const c = s.category || "기타";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [initialItems]);

  // 표시할 칩 순서 — 데이터에 존재하는 카테고리만, ORDER 순.
  const chips = useMemo(() => CATEGORY_ORDER.filter((c) => counts.has(c)), [counts]);

  // 카테고리 필터 + 검색(AND 결합). 검색은 원문(name/description/category/tags) 기준.
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initialItems.filter((s) => {
      if (activeCat !== ALL && (s.category || "기타") !== activeCat) return false;
      if (!query) return true;
      const hay = [s.name, s.description, s.category ?? "", ...(s.tags ?? [])].join(" ").toLowerCase();
      return hay.includes(query);
    });
  }, [q, activeCat, initialItems]);

  // 유스케이스 추천 — 검색어가 (번역된) 유스케이스 label/alias에 부분 매치하면 skillNames를
  // 실제 카탈로그 항목으로 해석해 추천 블록에 표시.
  const rec = useMemo(() => {
    const uc = matchUsecaseIn(usecases, q);
    if (!uc) return null;
    const byName = new Map(initialItems.map((s) => [s.name, s] as const));
    const cards = uc.skillNames.map((n) => byName.get(n)).filter((x): x is SkillItem => Boolean(x));
    return cards.length ? { uc, cards } : null;
  }, [q, initialItems, usecases]);

  // ── 검색 로그(프라이버시 우선) ──────────────────────────────────────────────
  // 확정 시(Enter 또는 800ms 디바운스)만 fire-and-forget POST. 검색어 없으면 안 보냄.
  // IP·개인정보 미전송(서버가 IP도 저장 안 함). 실패는 조용히 무시(UX 방해 금지).
  const lastSent = useRef("");
  const fireSearchLog = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (!query || query === lastSent.current) return; // 빈 검색어·직전 동일 검색어 스킵
      lastSent.current = query;
      const matched = matchUsecaseIn(usecases, query);
      fetch("/api/search-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.slice(0, 100),
          matchedUsecase: matched ? matched.id : null,
          resultCount: filtered.length,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [usecases, filtered.length],
  );

  // 디바운스: 입력 후 800ms 정지하면 1회 전송. 매 키 입력마다 타이머 리셋.
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => fireSearchLog(q), 800);
    return () => clearTimeout(t);
  }, [q, fireSearchLog]);

  // 초기 상태(전체 + 검색 없음)면 카테고리 그룹핑 렌더(SEO 시맨틱), 아니면 평면 리스트.
  const isInitial = activeCat === ALL && q.trim() === "";
  const groups = useMemo(() => (isInitial ? groupByCategory(filtered) : []), [isInitial, filtered]);

  const countSuffix = dict.catalog.countUnit ? ` ${dict.catalog.countUnit}` : "";

  return (
    <div>
      {/* 카테고리 칩 행 */}
      <nav aria-label={dict.catalog.eyebrow} className="mb-5 flex flex-wrap gap-2">
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
          {dict.catalog.all} ({initialItems.length})
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
              {catCatLabel(dict, c)} ({counts.get(c)})
            </button>
          );
        })}
      </nav>

      {/* 검색 */}
      <div className="sticky top-0 z-10 -mx-5 mb-6 border-b border-[var(--line-strong)] bg-[var(--paper)]/90 px-5 py-4 backdrop-blur">
        <label className="sr-only" htmlFor="catalog-search">
          {dict.catalog.searchLabel}
        </label>
        <input
          id="catalog-search"
          type="search"
          placeholder={dict.catalog.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") fireSearchLog(q);
          }}
          className="w-full rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-4 py-3 font-mono text-ink placeholder:text-[var(--ink-faint)]"
        />

        {/* 인기 용도 칩 — 클릭 = 그 (번역된) label로 검색. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.popularUses}</span>
          {usecases.map((uc) => (
            <button
              key={uc.id}
              type="button"
              onClick={() => setQ(uc.label)}
              className="rounded-full border border-dashed border-[var(--line-strong)] px-2.5 py-1 font-mono text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {uc.label}
            </button>
          ))}
        </div>

        <p className="mt-3 font-mono text-xs text-[var(--ink-faint)]">
          {filtered.length} / {initialItems.length}{countSuffix}
          {activeCat !== ALL && <span className="ml-2 text-[var(--accent)]">· {catCatLabel(dict, activeCat)}</span>}
        </p>
      </div>

      {/* 유스케이스 추천 블록 — 주황 테두리, 일반 결과 위. */}
      {rec && (
        <section
          aria-label={`${dict.catalog.recPrefix} ${rec.uc.label}`}
          className="mb-6 rounded-lg border-2 border-[var(--accent)] bg-[var(--paper-2)] px-5 py-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-serif text-xl font-bold text-ink">
              {dict.catalog.recPrefix} <span className="text-[var(--accent)]">{rec.uc.label}</span>
            </h2>
            <p className="text-sm text-[var(--ink-soft)]">{rec.uc.pitch}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {rec.cards.map((s) => (
              <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} />
            ))}
          </ul>
        </section>
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-[var(--ink-soft)]">{dict.catalog.noResults}</p>
      ) : isInitial ? (
        // 초기: 카테고리 그룹핑 (h2 헤딩 = SEO 시맨틱 구조)
        <div className="flex flex-col gap-10">
          {groups.map(([cat, list]) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2
                id={`cat-${cat}`}
                className="mb-4 flex items-baseline gap-2 border-b border-[var(--line-strong)] pb-2 font-serif text-2xl text-ink"
              >
                {catCatLabel(dict, cat)}
                <span className="font-mono text-sm text-[var(--ink-faint)]">{list.length}</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {list.map((s) => (
                  <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        // 필터/검색: 평면 리스트
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((s) => (
            <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} />
          ))}
        </ul>
      )}

      {/* 수집 고지 — 검색어 익명 수집 안내(프라이버시 우선) */}
      <p className="mt-10 border-t border-[var(--line)] pt-4 text-center font-mono text-xs text-[var(--ink-faint)]">
        {dict.catalog.searchNotice}
      </p>
    </div>
  );
}
