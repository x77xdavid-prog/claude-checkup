import type { MetadataRoute } from "next";
import { LOCALES, HREFLANG, DEFAULT_LOCALE } from "@/lib/i18n";

// 공개 색인 대상만 — /result(개인)·/api는 제외. 16 로케일 × 10 페이지.
// 각 URL에 hreflang alternates(languages)를 붙여 로케일 간 관계를 명시.
// vercel.app(프리뷰/낡은 env)이 canonical·OG·sitemap에 새는 것 차단 — 실도메인으로 강제.
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_URL = RAW_SITE_URL.includes(".vercel.app") ? "https://claudecowork.co.kr" : RAW_SITE_URL;

const PAGES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/start", changeFrequency: "monthly", priority: 0.9 },
  { path: "/prompts", changeFrequency: "weekly", priority: 0.9 },
  { path: "/catalog", changeFrequency: "weekly", priority: 0.9 },
  { path: "/guide", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.6 },
  { path: "/source-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/rubric", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

// 특정 페이지 경로의 로케일별 alternates 맵.
function altLanguages(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) map[HREFLANG[l]] = `${SITE_URL}/${l}${path}`;
  map["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
  return map;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const page of PAGES) {
    const languages = altLanguages(page.path);
    for (const l of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${l}${page.path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages },
      });
    }
  }
  return entries;
}
