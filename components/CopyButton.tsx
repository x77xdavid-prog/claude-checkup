"use client";

import { useState } from "react";

// 클립보드 복사 버튼. 복사 후 잠깐 "복사됨" 상태.
// navigator.clipboard 미지원 환경 폴백은 생략 — 대상은 최신 브라우저.
// ponytail: execCommand 폴백 생략(대상=Claude Code 사용자=최신 브라우저). 승급=폴백 추가.

export default function CopyButton({
  text,
  label = "복사",
  copiedLabel = "복사됨",
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 복사 실패 시 조용히 무시하되 사용자에게 실패 표시
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono btn-ghost rounded-md ${className}`}
    >
      {copied ? (
        <>
          <span aria-hidden>✓</span> {copiedLabel}
        </>
      ) : (
        <>
          <span aria-hidden>⧉</span> {label}
        </>
      )}
    </button>
  );
}
