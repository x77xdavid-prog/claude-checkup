import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Space_Mono } from "next/font/google";
import "../globals.css";
import { LOCALES, HREFLANG, DEFAULT_LOCALE, dirFor, getDict, isLocale, type Locale } from "@/lib/i18n";

// 디스플레이 세리프(성적표/에디토리얼 개성) — 라틴·숫자 강조용. 한글은 시스템 폰트로 fallback.
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

// 모노(숫자·코드 도장 느낌).
const monoCode = Space_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// 로케일 프리렌더 — 16개 정적 세그먼트.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// hreflang alternates 맵 — 모든 로케일 자기참조 + x-default(ko).
function languageAlternates(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of LOCALES) {
    map[HREFLANG[l]] = `${SITE_URL}/${l}${path}`;
  }
  map["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
  return map;
}

// 공유 hreflang 헬퍼(페이지 metadata에서 재사용).
export function alternatesFor(locale: Locale, path: string) {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: languageAlternates(path),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(locale);
  const loc = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: dict.meta.siteTitle,
      template: "%s | claude-checkup",
    },
    description: dict.meta.siteDesc,
    alternates: {
      canonical: `${SITE_URL}/${loc}`,
      languages: languageAlternates(""),
    },
    openGraph: {
      title: dict.meta.siteTitle,
      description: dict.meta.siteDesc,
      type: "website",
      locale: HREFLANG[loc].replace("-", "_"),
      siteName: "claude-checkup",
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dir = dirFor(locale as Locale);

  // suppressHydrationWarning: 서버 HTML엔 data-theme가 없고 아래 head 스크립트가
  // 첫 페인트 전 클라이언트에서 속성을 추가하므로 <html> 속성 mismatch 경고를 억제.
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* 테마 FOUC 방지 — blocking 인라인 스크립트가 첫 페인트 전 data-theme를 세팅.
            저장값("theme") 우선, 없으면 시스템 prefers-color-scheme. 실패 시 조용히 라이트. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("theme");var m=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",(t==="dark"||(t!=="light"&&m))?"dark":"light");}catch(e){}})();',
          }}
        />
      </head>
      <body className={`${display.variable} ${monoCode.variable} antialiased`}>{children}</body>
    </html>
  );
}
