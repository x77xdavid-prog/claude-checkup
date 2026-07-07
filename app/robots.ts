import type { MetadataRoute } from "next";

// 전체 allow + 개인 결과(/result/)·API(/api/) 차단 + sitemap 링크.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/result/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
