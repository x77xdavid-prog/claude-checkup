import type { Metadata } from "next";
import { Fraunces, Space_Mono } from "next/font/google";
import "./globals.css";

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

// metadataBase: 절대 URL 기준(OG/sitemap/canonical). env 없으면 로컬 fallback.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "claude-checkup — 당신의 클로드, 몇 점일까요?",
    template: "%s | claude-checkup",
  },
  description:
    "Claude Code 사용 수준 무료 진단·스킬 카탈로그·클로드 데일리 뉴스. 수집은 개수와 설정 여부만, 파일 내용은 전송하지 않습니다.",
  openGraph: {
    title: "claude-checkup — 당신의 클로드, 몇 점일까요?",
    description: "Claude Code 사용 수준 무료 진단·스킬 카탈로그·클로드 데일리 뉴스.",
    type: "website",
    locale: "ko_KR",
    siteName: "claude-checkup",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${display.variable} ${monoCode.variable} antialiased`}>{children}</body>
    </html>
  );
}
