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

export const metadata: Metadata = {
  title: "claude-checkup — 당신의 클로드, 몇 점일까요?",
  description:
    "내 Claude Code 사용 수준을 진단하고 부족한 부분을 개선하는 진단서. 수집은 개수와 설정 여부만, 파일 내용은 전송하지 않습니다.",
  openGraph: {
    title: "claude-checkup — 당신의 클로드, 몇 점일까요?",
    description: "Claude Code 활용도 진단 성적표. 개수·설정 여부만 수집.",
    type: "website",
  },
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
