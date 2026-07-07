// public/catalog.json 로더 + 정규화. 다른 에이전트가 생성 중 → 없을 수 있음(graceful).
// 스키마 미확정이라 흔한 형태를 모두 흡수해 SkillItem[]로 정규화.

import { promises as fs } from "fs";
import path from "path";
import type { SkillItem } from "@/components/CatalogBrowser";

export type { SkillItem };

// 최상위: 배열 | {skills|items|catalog: [...]} 모두 수용.
// 항목 필드: name|id|slug / description|desc|summary / install|command|installCommand|cmd / category|group / tags
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
  return { name, description, install, category, tags };
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
