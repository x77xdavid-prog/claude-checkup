// 카탈로그 공용 타입·순수 헬퍼 — CatalogBrowser·SkillCard·CatalogSearchHero·CatalogSidebar·FilterSheet 공유.
// 컴포넌트 간 순환 import를 피하려고 비컴포넌트 모듈로 분리(P1 리디자인에서 CatalogBrowser를 쪼개며 이동).
// 클라이언트 안전(순수 TS만 — fs 등 서버 전용 의존 없음).

import { CATEGORY_ORDER } from "@/lib/categories";
import type { Dict } from "@/lib/i18n";
import type { Install2, InstallKind } from "@/lib/install-command";

export interface SkillItem {
  name: string;
  description: string;
  descriptionEn?: string; // 비-ko 로케일 표시용 영어 번역 — 자체 저작 스킬(한글 설명)에만 존재
  install: string; // 레거시 설치 문자열 (없으면 빈 문자열) — install2로 대체됨
  category?: string;
  tags?: string[];
  source?: string; // "local" | "plugin:<마켓>" | "external:<repo>"
  collection?: string; // 외부 컬렉션 라벨(있으면 배지·칩 표시)
  install2?: Install2; // 빌드 시 선계산된 정직 설치 결과
  sourceUrl?: string; // 빌드 시 선계산된 정직 출처 링크(verified-repo·marketplace만; 미검증은 없음)
}

export const ALL = "__ALL__"; // 내부 sentinel(로케일 무관)

// 검증 3단계 배지 — 진단서/성적표 팔레트(기존 verdict 토큰) 재사용으로 시각적으로 구분.
// verified-repo=녹색(최강 긍정) · marketplace=주황(구별되는 2단계) · unverified=회색 점선(무채색 주의).
// glyphCls는 자동완성 행의 "배지 축약"(글리프만) 표시용 색.
export const TIER: Record<
  InstallKind,
  { labelKey: keyof Dict["catalog"]; descKey: keyof Dict["catalog"]; cls: string; glyph: string; glyphCls: string }
> = {
  "verified-repo": {
    labelKey: "tierVerified",
    descKey: "tierVerifiedDesc",
    cls: "border-[var(--c-good)] bg-[var(--c-good-bg)] text-[var(--c-good)]",
    glyph: "✓",
    glyphCls: "text-[var(--c-good)]",
  },
  marketplace: {
    labelKey: "tierMarketplace",
    descKey: "tierMarketplaceDesc",
    cls: "border-[var(--accent)] bg-[var(--c-gap-bg)] text-[var(--accent-ink)]",
    glyph: "◆",
    glyphCls: "text-[var(--accent-ink)]",
  },
  unverified: {
    labelKey: "tierUnverified",
    descKey: "tierUnverifiedDesc",
    cls: "border-dashed border-[var(--line-strong)] bg-[var(--c-skip-bg)] text-[var(--ink-faint)]",
    glyph: "△",
    glyphCls: "text-[var(--ink-faint)]",
  },
};

export function isTierKind(k: unknown): k is InstallKind {
  return k === "verified-repo" || k === "marketplace" || k === "unverified";
}

// 표시 순서대로 정렬된 [카테고리, 항목[]] 그룹. 데이터에 있는 카테고리만.
export function groupByCategory(items: SkillItem[]): [string, SkillItem[]][] {
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

// ko는 원문, 그 외 로케일은 영어 폴백(있을 때만). descriptionEn은 설명이 한글인 자체 저작 스킬에만 있다.
export function skillDesc(s: SkillItem, locale: string): string {
  return locale !== "ko" && s.descriptionEn ? s.descriptionEn : s.description;
}

// 한 항목이 (카테고리·컬렉션 AND) + 소문자 term 부분일치에 걸리는가. term 빈 문자열이면 필터만 적용.
// 검색은 description·descriptionEn 양쪽 매칭(표시 vs 비교 분리 — 렌더만 skillDesc로 로케일별).
export function itemMatches(s: SkillItem, term: string, activeCat: string, activeCol: string): boolean {
  if (activeCat !== ALL && (s.category || "기타") !== activeCat) return false;
  if (activeCol !== ALL && s.collection !== activeCol) return false;
  if (!term) return true;
  const hay = [s.name, s.description, s.descriptionEn ?? "", s.category ?? "", ...(s.tags ?? [])].join(" ").toLowerCase();
  return hay.includes(term);
}

// "{n}" 토큰 치환 — 개수는 전부 계산값으로 주입(스킬 개수 하드코딩 금지 게이트와 같은 원칙).
export function injectN(s: string, n: number): string {
  return s.replace(/\{n\}/g, String(n));
}

// 사이드바(데스크톱)·필터 시트(모바일)가 공유하는 props — 카운트는 부모의 useMemo 계산값.
export interface CatalogFilterProps {
  dict: Dict;
  chips: string[]; // 데이터에 존재하는 카테고리(표시 순)
  counts: Map<string, number>; // 카테고리별 개수(원본 전체 기준)
  total: number; // 전체 항목 수
  collections: [string, number][]; // [컬렉션명, 개수] — 개수 내림차순
  activeCat: string;
  activeCol: string;
  onCat: (c: string) => void;
  onCol: (c: string) => void;
}
