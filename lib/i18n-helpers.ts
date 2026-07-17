// i18n 조회 헬퍼 — 사전(Dict)에서 안전하게 값을 꺼낸다. 키 없으면 원문(ko값) 폴백은
// getDict가 ko로 폴백하므로 여기선 "키가 사전에 없으면 fallback 인자" 규칙만 담당.
// 서버·클라이언트 양쪽에서 쓰이는 순수 함수(직렬화 가능한 값만 다룸).

import type { Dict } from "@/lib/i18n";
import { categoryRecFor, recsFor, type Rec } from "@/lib/recommendations";
import { USECASES, type Usecase } from "@/lib/usecases";

// 중첩 키("a.b.c")로 사전에서 문자열 조회. 없으면 fallback.
function pick(dict: Dict, path: string, fallback: string): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return fallback;
    }
  }
  return typeof cur === "string" ? cur : fallback;
}

// recTip/recName 사전은 점(.)이 포함된 "평면 키"를 값으로 갖는다(예: "agents.서브에이전트 위임").
// 따라서 중첩 탐색이 아니라 해당 서브객체에서 정확한 키를 직접 찾는다.
function pickFlat(dict: Dict, group: "recTip" | "recName" | "usecase" | "catCat" | "catCol", flatKey: string, fallback: string): string {
  const g = (dict as unknown as Record<string, Record<string, string>>)[group];
  if (g && typeof g === "object" && typeof g[flatKey] === "string") return g[flatKey];
  return fallback;
}

// ── verdict 라벨 (DB의 한국어 verdict → 표시 문자열) ─────────────────────
// 데이터 모델의 verdict는 한국어 그대로 유지(스키마·와이어 계약). 표시만 번역.
const VERDICT_KEY: Record<string, "good" | "knowGap" | "skip"> = {
  잘씀: "good",
  몰라서: "knowGap",
  불필요: "skip",
};

export function verdictLabel(dict: Dict, verdict: string): string {
  const k = VERDICT_KEY[verdict] ?? "skip";
  return dict.verdict[k];
}

// ── 점수 카테고리 라벨 (score.ts key → 표시 문자열) ──────────────────────
// integration/integrations 별칭 흡수(스캐너가 integrations 복수 사용).
export function scoreCatLabel(dict: Dict, key: string): string {
  const canonical = key === "integrations" ? "integration" : key;
  return pick(dict, `scoreCat.${canonical}`, key);
}

// ── 개선 액션 (score.ts key → 번역 문구) ─────────────────────────────────
export function improveLabel(dict: Dict, key: string): string {
  const canonical = key === "integrations" ? "integration" : key;
  return pick(dict, `improve.${canonical}`, dict.improve.fallback);
}

// ── 등급 헤드라인 (letter → 번역) ────────────────────────────────────────
export function gradeHeadline(dict: Dict, letter: string): string {
  return pick(dict, `grade.${letter}`, letter);
}

// ── 카탈로그 카테고리 라벨 (한국어 카테고리명 → 번역) ────────────────────
export function catCatLabel(dict: Dict, koCategory: string): string {
  return pickFlat(dict, "catCat", koCategory, koCategory);
}

// ── 카탈로그 컬렉션 라벨 (한국어 컬렉션명 → 번역) ────────────────────────
// catCat과 동일 규약: 데이터(카탈로그)의 collection 값은 한국어 원문이므로 사전 키도 한국어.
// 필터 비교·상태값은 원문 그대로 두고 "표시"만 이 함수를 통과시킨다.
export function catColLabel(dict: Dict, koCollection: string): string {
  return pickFlat(dict, "catCol", koCollection, koCollection);
}

// ── 추천(Rec) 번역 — name/tip만 번역, command는 원문 유지(복사·검증 대상) ──
export interface LocalizedRec extends Rec {
  displayName: string;
  displayTip: string;
}

export function localizedRecs(dict: Dict, categoryKey: string, n = 2): LocalizedRec[] {
  const canonicalEntry = categoryRecFor(categoryKey); // 별칭 해석된 CategoryRec
  const canonicalKey = canonicalEntry?.key ?? categoryKey;
  const recs = recsFor(categoryKey, n);
  return recs.map((r) => ({
    ...r,
    displayName: pickFlat(dict, "recName", r.name, r.name),
    displayTip: pickFlat(dict, "recTip", `${canonicalKey}.${r.name}`, r.tip),
  }));
}

// ── 유스케이스 번역 — label/pitch 번역 + aliases에 번역 label 추가(칩 클릭 매칭 유지) ──
export function localizedUsecases(dict: Dict): Usecase[] {
  return USECASES.map((uc) => {
    const label = pickFlat(dict, "usecase", `${uc.id}.label`, uc.label);
    const pitch = pickFlat(dict, "usecase", `${uc.id}.pitch`, uc.pitch);
    // 원본 한국어 aliases + 번역 label(소문자) → 어떤 로케일 칩을 눌러도 매칭.
    const aliases = Array.from(new Set([...uc.aliases, uc.label.toLowerCase(), label.toLowerCase()]));
    return { ...uc, label, pitch, aliases };
  });
}

// ── 최소 자가검증 ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  // 동적 import 없이 ko 사전으로 라운드트립 확인
  // (ts로 직접 실행되지 않으므로 여기선 형태만 문서화; 실제 검증은 i18n.ts self-check가 담당)
  console.log("i18n-helpers.ts loaded");
}
