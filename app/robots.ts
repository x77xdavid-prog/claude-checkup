import type { MetadataRoute } from "next";

// 전체 allow + 개인 결과(/*/result/)·API(/api/) 차단 + sitemap 링크.
// 결과 페이지는 로케일 프리픽스 아래(/en/result/…) 있으므로 와일드카드로 막는다.
// vercel.app(프리뷰/낡은 env)이 canonical·OG·sitemap에 새는 것 차단 — 실도메인으로 강제.
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SITE_URL = RAW_SITE_URL.includes(".vercel.app") ? "https://claudecowork.co.kr" : RAW_SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/*/result/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
