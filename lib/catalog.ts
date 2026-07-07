// public/catalog.json 로더 + 정규화. 다른 에이전트가 생성 중 → 없을 수 있음(graceful).
// 스키마 미확정이라 흔한 형태를 모두 흡수해 SkillItem[]로 정규화.

import { promises as fs, readFileSync } from "fs";
import path from "path";
import type { SkillItem } from "@/components/CatalogBrowser";
import type { Install2 } from "@/lib/install-command";

export type { SkillItem };
// CATEGORY_ORDER는 fs 비의존 모듈로 분리(클라이언트 번들 안전). 여기선 재-export만.
export { CATEGORY_ORDER } from "./categories";

// 최상위: 배열 | {skills|items|catalog: [...]} 모두 수용.
// 항목 필드: name|id|slug / description|desc|summary / install|command|installCommand|cmd / category|group / tags
// + source(local | plugin:<마켓>) / install2(빌드 시 선계산된 정직 설치 결과) 통과.
function normalizeItem(raw: unknown): SkillItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (...keys: string[]): string => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };
  const name = str("name", "id", "slug", "title");
  if (!name) return null;
  const description = str("description", "desc", "summary", "about");
  const install = str("install", "installCommand", "command", "cmd", "installCmd");
  const category = str("category", "group", "type") || undefined;
  const tags = Array.isArray(o.tags) ? (o.tags.filter((t) => typeof t === "string") as string[]) : undefined;
  const source = typeof o.source === "string" ? o.source : undefined;
  const install2 = isInstall2(o.install2) ? o.install2 : undefined;
  return { name, description, install, category, tags, source, install2 };
}

// install2 형태 최소 검증(신뢰 경계 — 카탈로그 파일 = 외부 데이터로 취급).
function isInstall2(v: unknown): v is Install2 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.kind === "marketplace" || o.kind === "verified-repo" || o.kind === "unverified") &&
    (o.command === null || typeof o.command === "string")
  );
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["skills", "items", "catalog", "entries"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return [];
}

// 반환: SkillItem[] | null(파일 없음). 파일은 있으나 비어도 [] 반환.
export async function loadCatalog(): Promise<SkillItem[] | null> {
  const file = path.join(process.cwd(), "public", "catalog.json");
  let text: string;
  try {
    text = await fs.readFile(file, "utf-8");
  } catch {
    return null; // 아직 생성 전
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null; // 손상된 JSON도 "생성 전"으로 취급(안내 렌더)
  }
  const items = extractArray(data)
    .map(normalizeItem)
    .filter((x): x is SkillItem => x !== null);
  return items;
}

// 동기 버전 — 서버 컴포넌트에서 빌드/요청 시 HTML에 스킬을 담기 위해 사용(SEO 핵심).
// 반환: SkillItem[] | null(파일 없음/손상). 정규화 로직은 loadCatalog와 동일.
export function loadCatalogSync(): SkillItem[] | null {
  const file = path.join(process.cwd(), "public", "catalog.json");
  let text: string;
  try {
    text = readFileSync(file, "utf-8");
  } catch {
    return null;
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  return extractArray(data)
    .map(normalizeItem)
    .filter((x): x is SkillItem => x !== null);
}
