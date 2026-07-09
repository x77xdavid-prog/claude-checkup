// RSS 2.0 피드 — 최근 추가된 스킬. public/whats-new.json을 빌드시 정적 생성.
import whatsNew from "@/public/whats-new.json";

const SITE = "https://claudecowork.co.kr";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const dynamic = "force-static";

export function GET() {
  const items = (whatsNew.items ?? []).slice(0, 30) as { name: string; category: string | null; addedAt: string }[];
  const rssItems = items
    .map((it) => {
      const title = it.category ? `${it.name} [${it.category}]` : it.name;
      const pub = new Date(it.addedAt).toUTCString();
      return `    <item>
      <title>${esc(title)}</title>
      <link>${SITE}/ko/catalog</link>
      <guid isPermaLink="false">skill:${esc(it.name)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${esc(`새 스킬 추가: ${it.name}`)}</description>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>claude-checkup — 새로 추가된 스킬</title>
    <link>${SITE}/ko/catalog</link>
    <description>claude-checkup 카탈로그에 새로 추가된 Claude Code 스킬</description>
    <language>ko</language>
${rssItems}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
