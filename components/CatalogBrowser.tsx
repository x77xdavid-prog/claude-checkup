"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CATEGORY_ORDER } from "@/lib/categories";
import { matchUsecaseIn, type Usecase } from "@/lib/usecases";
import type { Dict } from "@/lib/i18n";
import { catCatLabel } from "@/lib/i18n-helpers";
import { expandQuery } from "@/lib/search-expand";
import { ALL, groupByCategory, itemMatches, type SkillItem } from "./catalog-shared";
import SkillCard, { TierBadge } from "./SkillCard";
import CatalogSearchHero from "./CatalogSearchHero";
import CatalogSidebar from "./CatalogSidebar";
import FilterSheet from "./FilterSheet";

// 스킬 카탈로그 검색 + 카테고리 필터 + 설치 명령 복사 — P1 리디자인(검색 히어로·카드 v2·
// 사이드바/필터 시트·인기순 정렬). 데이터는 서버에서 initialItems로 주입(SEO: 초기 HTML에
// 전체 스킬 포함 — 초기 뷰의 카테고리 그룹 렌더 골격은 그대로 보존).
// 스킬 description·install 명령은 원문 유지(번역 안 함). UI 크롬만 dict로 번역.
// 카드·필터·검색 히어로는 분리 컴포넌트(SkillCard·CatalogSidebar·FilterSheet·CatalogSearchHero),
// 공용 타입·순수 헬퍼는 catalog-shared.ts.

// lib/catalog.ts 등 기존 소비자 호환 — SkillItem 타입은 catalog-shared로 이동했고 여기서 재수출.
export type { SkillItem } from "./catalog-shared";

const LOW_RESULTS = 3; // baseFiltered가 이 미만이면 동의어 확장 병합(mcp/lib.mjs와 동일 임계값)

type SortMode = "default" | "popular";

export default function CatalogBrowser({
  initialItems,
  dict,
  usecases,
  initialQuery = "",
}: {
  initialItems: SkillItem[];
  dict: Dict;
  usecases: Usecase[];
  initialQuery?: string; // /catalog?q= 로 초기 검색어 시딩(프롬프트 업셀·레벨 처방에서 유입). 검색 로직은 그대로.
}) {
  const [q, setQ] = useState(initialQuery);
  const [activeCat, setActiveCat] = useState<string>(ALL); // ALL = 전체
  const [activeCol, setActiveCol] = useState<string>(ALL); // 컬렉션 필터(카테고리와 AND)
  const [sort, setSort] = useState<SortMode>("default"); // 기본(현행 순서) / 인기순(설치수 desc)

  // 현재 로케일 — /[locale]/catalog 라우트 파라미터에서 취득(런타임 i18n 미포함, 번들 경량 유지).
  // 이 컴포넌트는 [locale] 밑에서만 렌더되므로 항상 존재하지만, 방어적으로 ko 폴백.
  const routeParams = useParams<{ locale?: string }>();
  const locale = typeof routeParams?.locale === "string" && routeParams.locale ? routeParams.locale : "ko";

  // ④ 인기 설치수 — 마운트 시 1회 funnel-stats 조회(topInstalls 최대 10개).
  // 실패는 조용히(콘솔 경고만) — 카운트 미표시 + 인기순은 사실상 기본 순서로 동작(UI 영향 0).
  const [installCounts, setInstallCounts] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/funnel-stats?days=30", { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          data?: { topInstalls?: Array<{ name?: unknown; count?: unknown }> } | null;
        };
        const top = Array.isArray(json.data?.topInstalls) ? json.data.topInstalls : [];
        const m = new Map<string, number>();
        for (const t of top) {
          if (t && typeof t.name === "string" && typeof t.count === "number" && t.count > 0) m.set(t.name, t.count);
        }
        setInstallCounts(m);
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn("funnel-stats 로드 실패(설치수·인기순 비표시):", e);
      }
    })();
    return () => ctrl.abort();
  }, []);

  // 예문(샘플 프롬프트) 인덱스 — 첫 비어있지 않은 검색어 입력 시 1회만 지연 로드(~수백 KB라
  // 초기 페이지 로드에 얹지 않음). 실패는 조용히 null 유지 = 예문 검색만 빠지는 성능저하(재시도 없음).
  const promptIndexRequested = useRef(false);
  const [promptIndex, setPromptIndex] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (!q.trim() || promptIndexRequested.current) return;
    promptIndexRequested.current = true;
    (async () => {
      try {
        const res = await fetch("/api/prompt-index");
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as unknown;
        if (json && typeof json === "object" && !Array.isArray(json)) {
          setPromptIndex(json as Record<string, string>);
        }
      } catch (e) {
        console.warn("prompt-index 로드 실패(예문 검색 비활성 — 기본 검색은 그대로):", e);
      }
    })();
  }, [q]);

  // 카테고리별 개수 — 사이드바·필터 시트 배지용(원본 전체 기준, 검색과 무관).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of initialItems) {
      const c = s.category || "기타";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [initialItems]);

  // 표시할 카테고리 순서 — 데이터에 존재하는 카테고리만, ORDER 순.
  const chips = useMemo(() => CATEGORY_ORDER.filter((c) => counts.has(c)), [counts]);

  // 컬렉션 목록 + 개수 — 있는 컬렉션만, 개수 내림차순. 없으면 UI 자체를 숨김.
  const collections = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of initialItems) if (s.collection) m.set(s.collection, (m.get(s.collection) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [initialItems]);

  // 카테고리 + 컬렉션 + 검색(모두 AND). 검색은 원문(name/description/category/tags) 기준.
  // L1(정확 이름)·L2(부분일치)는 이 부분일치로 함께 커버(기존 동작).
  const baseFiltered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return initialItems.filter((s) => itemMatches(s, query, activeCat, activeCol));
  }, [q, activeCat, activeCol, initialItems]);

  // L3 — baseFiltered가 적으면(few/zero) 동의어(ko↔en) 확장으로 병합(카테고리·컬렉션 필터 존중, dedupe).
  // 결과가 충분하면 그대로 두어 과확장을 피한다.
  // L4 — 예문(샘플 프롬프트) 본문 일치: 인덱스가 로드됐고 검색어가 있으면, 아직 없는 항목 중
  // 예문에 검색어가 포함되고 카테고리·컬렉션 필터를 통과하는 것을 뒤에 append(L1/L2/L3 순서 불변).
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return baseFiltered;
    const seen = new Set(baseFiltered.map((s) => s.name));
    const merged = [...baseFiltered];
    if (baseFiltered.length < LOW_RESULTS) {
      for (const term of expandQuery(query)) {
        if (term === query) continue; // 원질의는 baseFiltered에 이미 반영
        for (const s of initialItems) {
          if (!seen.has(s.name) && itemMatches(s, term, activeCat, activeCol)) {
            seen.add(s.name);
            merged.push(s);
          }
        }
      }
    }
    if (promptIndex) {
      for (const s of initialItems) {
        if (seen.has(s.name)) continue;
        const hay = promptIndex[s.name];
        // term "" = 카테고리·컬렉션 필터만 적용(예문 일치는 인덱스로 이미 판정).
        if (typeof hay === "string" && hay.includes(query) && itemMatches(s, "", activeCat, activeCol)) {
          seen.add(s.name);
          merged.push(s);
        }
      }
    }
    return merged;
  }, [q, baseFiltered, initialItems, activeCat, activeCol, promptIndex]);

  // ④ 인기순 — 설치수 있는 항목 count desc 우선, 나머지는 현행 순서 유지(안정 정렬).
  // 통계 실패(null)·기본 정렬이면 results 그대로.
  const sorted = useMemo(() => {
    if (sort !== "popular" || !installCounts || installCounts.size === 0) return results;
    return [...results].sort((a, b) => (installCounts.get(b.name) ?? 0) - (installCounts.get(a.name) ?? 0));
  }, [results, sort, installCounts]);

  // 유스케이스 추천 — 검색어가 (번역된) 유스케이스 label/alias에 부분 매치하면 skillNames를
  // 실제 카탈로그 항목으로 해석해 추천 블록에 표시.
  const rec = useMemo(() => {
    const uc = matchUsecaseIn(usecases, q);
    if (!uc) return null;
    const byName = new Map(initialItems.map((s) => [s.name, s] as const));
    // 추천도 활성 카테고리·컬렉션을 존중(정직성) — 필터와 어긋나는 카드는 숨겨서
    // "카테고리 선택 중인데 딴 카테고리 스킬이 추천되는" 오해를 막는다.
    const cards = uc.skillNames
      .map((n) => byName.get(n))
      .filter((x): x is SkillItem => Boolean(x))
      .filter(
        (s) =>
          (activeCat === ALL || (s.category || "기타") === activeCat) &&
          (activeCol === ALL || s.collection === activeCol),
      );
    return cards.length ? { uc, cards } : null;
  }, [q, initialItems, usecases, activeCat, activeCol]);

  // 폴백 패널 데이터(#14) — 검색 결과가 0건일 때만. 막다른 "0건" 대신:
  // (a) 질의/동의어에 맞는 카테고리 제안, (b) 가장 가까운 카테고리의 스킬 최대 6개(정직: 인기 아님).
  const fallback = useMemo(() => {
    const query = q.trim();
    if (!query || results.length > 0) return null;
    const terms = expandQuery(query.toLowerCase());
    const matchedCats = chips.filter((cat) => {
      const cl = cat.toLowerCase();
      return terms.some((t) => t.length >= 2 && (cl.includes(t) || t.includes(cl)));
    });
    const closest = matchedCats[0] ?? null;
    const similar = closest ? initialItems.filter((s) => (s.category || "기타") === closest).slice(0, 6) : [];
    return { matchedCats, closest, similar };
  }, [q, results.length, chips, initialItems]);

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
          resultCount: results.length, // 확장·폴백 반영한 실제 표시 결과 수(0건도 그대로 기록 → 카탈로그 보강 신호)
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [usecases, results.length],
  );

  // 디바운스: 입력 후 800ms 정지하면 1회 전송. 매 키 입력마다 타이머 리셋.
  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => fireSearchLog(q), 800);
    return () => clearTimeout(t);
  }, [q, fireSearchLog]);

  // 초기 상태(전체 + 컬렉션 전체 + 검색 없음 + 기본 정렬)면 카테고리 그룹핑 렌더(SEO 시맨틱 —
  // SSR 초기 HTML은 항상 이 분기), 아니면 평면 리스트. 인기순은 사용자 조작 후에만 활성.
  const isInitial = activeCat === ALL && activeCol === ALL && q.trim() === "" && sort === "default";
  const groups = useMemo(() => (isInitial ? groupByCategory(sorted) : []), [isInitial, sorted]);

  const countSuffix = dict.catalog.countUnit ? ` ${dict.catalog.countUnit}` : "";

  const filterProps = {
    dict,
    chips,
    counts,
    total: initialItems.length,
    collections,
    activeCat,
    activeCol,
    onCat: setActiveCat,
    onCol: setActiveCol,
  };

  return (
    <div>
      {/* ① 검색 히어로 — 페이지의 CTA. 자동완성은 전부 클라이언트 매칭(API 호출 없음). */}
      <CatalogSearchHero
        value={q}
        onChange={setQ}
        results={sorted}
        installCounts={installCounts}
        dict={dict}
        onSubmit={() => fireSearchLog(q)}
      />

      {/* 인기 용도 칩 — 검색바 바로 아래. 클릭 = 그 (번역된) label로 검색. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.popularUses}</span>
        {usecases.map((uc) => (
          <button
            key={uc.id}
            type="button"
            onClick={() => {
              // 인기 용도는 카테고리를 가로지르는 의도 → 활성 카테고리 초기화(선택된 카테고리와
              // AND 되어 0건이 되고 추천만 뜨는 오해 방지). 컬렉션도 함께 초기화.
              setActiveCat(ALL);
              setActiveCol(ALL);
              setQ(uc.label);
            }}
            className="rounded-full border border-dashed border-[var(--line-strong)] px-2.5 py-1 font-mono text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {uc.label}
          </button>
        ))}
      </div>

      {/* 설치 장벽 해소 배너 — 검색 히어로 아래로 강등(접이식 컴팩트). 기존 mp* 키 전부 재사용,
          내용은 details 안에 항상 DOM 존재(초기 HTML 유지 — SEO 무손실). */}
      <details className="mt-5 rounded-lg border-[1.5px] border-[var(--line-strong)] bg-[var(--paper-2)] px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span className="font-serif text-base font-bold text-ink">{dict.catalog.mpTitle}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4 shrink-0 text-[var(--ink-soft)]"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-2">
          <p className="text-sm text-[var(--ink-soft)]">
            {dict.catalog.mpBodyPre} <strong className="text-ink">{dict.catalog.mpBodyStrong}</strong>{" "}
            {dict.catalog.mpBodyPost}
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-[#2a2a2a] px-4 py-3 font-mono text-sm text-[#f4f4f4]">
            /plugin marketplace add x77xdavid-prog/checkup-skills
          </code>
          <p className="mt-2 font-mono text-xs text-[var(--ink-faint)]">
            {dict.catalog.mpListPre}{" "}
            <a
              className="underline"
              href="https://github.com/x77xdavid-prog/checkup-skills"
              rel="noopener noreferrer"
              target="_blank"
            >
              {dict.catalog.mpGithub}
            </a>
          </p>
        </div>
      </details>

      {/* ③ 사이드바(lg+) + 본문 */}
      <div className="mt-8 lg:flex lg:items-start lg:gap-8">
        <CatalogSidebar {...filterProps} />

        <div className="min-w-0 flex-1">
          {/* 툴바 — 결과 수(계산값) + 필터 시트 트리거(lg 미만) + 정렬 셀렉트 */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="font-mono text-xs text-[var(--ink-faint)]">
              {sorted.length} / {initialItems.length}
              {countSuffix}
              {activeCat !== ALL && <span className="ms-2 text-[var(--accent)]">· {catCatLabel(dict, activeCat)}</span>}
              {activeCol !== ALL && <span className="ms-2 text-[var(--accent)]">· {activeCol}</span>}
            </p>
            <div className="flex items-center gap-2">
              <FilterSheet {...filterProps} />
              <label className="sr-only" htmlFor="catalog-sort">
                {dict.catalog.sortLabel}
              </label>
              <select
                id="catalog-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value === "popular" ? "popular" : "default")}
                className="min-h-11 rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-3 font-mono text-xs text-[var(--ink-soft)]"
              >
                <option value="default">{dict.catalog.sortDefault}</option>
                <option value="popular">{dict.catalog.sortPopular}</option>
              </select>
            </div>
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
                  <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} installCount={installCounts?.get(s.name)} />
                ))}
              </ul>
            </section>
          )}

          {/* 검증 3단계 범례 — 리스트 위 한 줄(dict 기반). 표시할 카드가 있을 때만. */}
          {sorted.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs text-[var(--ink-faint)]">
              <span className="uppercase tracking-wider">{dict.catalog.tierLegendLabel}</span>
              <span className="inline-flex items-center gap-1.5">
                <TierBadge kind="verified-repo" dict={dict} />
                <span>{dict.catalog.tierVerifiedDesc}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TierBadge kind="marketplace" dict={dict} />
                <span>{dict.catalog.tierMarketplaceDesc}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <TierBadge kind="unverified" dict={dict} />
                <span>{dict.catalog.tierUnverifiedDesc}</span>
              </span>
              {/* 배지 부여 기준 공개 페이지(/rubric) — 범례 옆 상시 링크(신뢰 문서 연결). */}
              <Link href={`/${locale}/rubric`} className="link-ink underline">
                {dict.catalog.legendRubric} →
              </Link>
            </div>
          )}

          {sorted.length === 0 ? (
            // 추천(용도) 블록이 답을 채우면 폴백을 띄우지 않는다(모순 표시 방지).
            // 그 외 검색 0건은 막다른 "0건" 대신 폴백 패널(카테고리 제안 + 근접 스킬 + 기록 고지).
            rec ? null : fallback ? (
              <section
                aria-label={dict.catalog.fallbackHeading}
                className="rounded-lg border-[1.5px] border-dashed border-[var(--line-strong)] bg-[var(--paper-2)] px-5 py-6"
              >
                <h2 className="font-serif text-xl font-bold text-ink">{dict.catalog.fallbackHeading}</h2>

                {fallback.matchedCats.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.fallbackCategories}</p>
                    <div className="flex flex-wrap gap-2">
                      {fallback.matchedCats.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setQ("");
                            setActiveCol(ALL);
                            setActiveCat(cat);
                          }}
                          className="rounded-full border-[1.5px] border-[var(--line-strong)] px-3 py-1 font-mono text-xs text-[var(--ink-soft)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          {catCatLabel(dict, cat)} ({counts.get(cat)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {fallback.similar.length > 0 && fallback.closest && (
                  <div className="mt-5">
                    <p className="mb-2 font-mono text-xs text-[var(--ink-faint)]">
                      {dict.catalog.fallbackSimilar}{" "}
                      <span className="text-[var(--ink-soft)]">
                        · {catCatLabel(dict, fallback.closest)} {dict.catalog.fallbackSimilarHint}
                      </span>
                    </p>
                    <ul className="grid gap-4 sm:grid-cols-2">
                      {fallback.similar.map((s) => (
                        <SkillCard
                          key={s.name}
                          s={s}
                          dict={dict}
                          onPick={setQ}
                          installCount={installCounts?.get(s.name)}
                        />
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-5 font-mono text-xs text-[var(--ink-soft)]">{dict.catalog.fallbackBrowse}</p>
                <p className="mt-1.5 font-mono text-xs text-[var(--ink-faint)]">{dict.catalog.fallbackLogged}</p>
              </section>
            ) : (
              <p className="py-16 text-center text-[var(--ink-soft)]">{dict.catalog.noResults}</p>
            )
          ) : isInitial ? (
            // 초기: 카테고리 그룹핑 (h2 헤딩 = SEO 시맨틱 구조 — 초기 HTML에 전체 스킬 유지)
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
                      <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} installCount={installCounts?.get(s.name)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            // 필터/검색/인기순: 평면 리스트
            <ul className="grid gap-4 sm:grid-cols-2">
              {sorted.map((s) => (
                <SkillCard key={s.name} s={s} dict={dict} onPick={setQ} installCount={installCounts?.get(s.name)} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 수집 고지 — 검색어 익명 수집 안내(프라이버시 우선) */}
      <p className="mt-10 border-t border-[var(--line)] pt-4 text-center font-mono text-xs text-[var(--ink-faint)]">
        {dict.catalog.searchNotice}
      </p>
    </div>
  );
}
