// 검색어 동의어 확장 — ko↔en 교차검색(#15) + 폴백 체인(#14)의 L3.
// data/search-synonyms.json(단일 진실 소스)을 읽어 질의어를 같은 그룹의 동의어들로 확장한다.
// 순수 함수 · 클라이언트 안전(Node 전용 전역 미사용 — CatalogBrowser가 런타임 import).
// mcp/lib.mjs가 동일 로직을 자립 재구현한다(코드베이스 관례: 공유 대신 재구현 — cli/mcp 독립성 유지).

import synonymsData from "@/data/search-synonyms.json";

const GROUPS: string[][] = Array.isArray((synonymsData as { groups?: unknown }).groups)
  ? (synonymsData as { groups: string[][] }).groups
  : [];

// 그룹 멤버 m이 질의 q와 관련되는가.
// 정확 일치, 또는 멤버가 3자 이상(영문)이거나 한글이면 부분일치 양방향 허용.
// 짧은 영문 2자(예: "ui")는 정확 일치만 — "build"⊃"ui" 같은 오검색을 막는다.
function memberHit(m: string, q: string): boolean {
  const ml = m.toLowerCase();
  if (ml === q) return true;
  const hasHangul = /[가-힣]/.test(ml);
  if (ml.length >= 3 || hasHangul) {
    if (q.length >= 2 && ml.includes(q)) return true;
    if (q.includes(ml)) return true;
  }
  return false;
}

// 질의어 → [원질의, ...동의어(소문자)]. 원질의가 항상 첫 요소. 확장이 없으면 [q]만 반환.
// 반환 순서: 원질의 우선 → 매칭 그룹 순. 호출부는 각 항목으로 filterCatalog 후 dedupe 병합한다.
export function expandQuery(query: string): string[] {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return q ? [q] : [];
  const out = new Set<string>([q]);
  for (const group of GROUPS) {
    if (group.some((m) => memberHit(m, q))) {
      for (const m of group) out.add(m.toLowerCase());
    }
  }
  return [...out];
}

// 질의어가 어떤 동의어 그룹에라도 걸리는지(원질의 외 확장어가 생기는지) 여부.
export function hasSynonyms(query: string): boolean {
  return expandQuery(query).length > 1;
}
