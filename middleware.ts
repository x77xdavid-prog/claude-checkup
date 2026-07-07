// 로케일 프리픽스 미들웨어. 프리픽스 없는 요청을 Accept-Language 매칭으로
// /{locale}/... 리다이렉트한다(기본 ko). /api·/_next·정적 파일·sitemap·robots 제외.
// 외부 의존성 없음 — Accept-Language 파싱을 직접 구현.

import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

// 이미 프리픽스가 있는지: 첫 세그먼트가 로케일이면 통과.
function hasLocalePrefix(pathname: string): boolean {
  const seg = pathname.split("/")[1];
  return (LOCALES as readonly string[]).includes(seg);
}

// Accept-Language 헤더 → 최적 로케일. q값 정렬 후 첫 매치.
// "zh-CN"·"zh-TW"는 정확 매치 우선, 아니면 기본언어(zh→zh-CN) 근사.
function pickLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? parseFloat(q.split("=")[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q);

  const lower = new Map(LOCALES.map((l) => [l.toLowerCase(), l] as const));

  for (const { tag } of wanted) {
    // 1) 정확 매치 (zh-cn → zh-CN)
    const exact = lower.get(tag);
    if (exact) return exact;
    // 2) 기본언어 매치 (en-us → en, pt-br → pt)
    const base = tag.split("-")[0];
    const baseHit = lower.get(base);
    if (baseHit) return baseHit;
    // 3) 중국어 특례: zh → zh-CN
    if (base === "zh") return "zh-CN";
  }
  return DEFAULT_LOCALE;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 이미 로케일 프리픽스가 있으면 그대로 진행.
  if (hasLocalePrefix(pathname)) return NextResponse.next();

  // 프리픽스 없는 요청 → Accept-Language 매칭 로케일로 리다이렉트.
  const locale = pickLocale(req.headers.get("accept-language"));
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

// /api·/_next·정적 파일·sitemap·robots·favicon은 미들웨어 제외(프리픽스 붙이지 않음).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)"],
};
