"use client";

import { useState } from "react";

// 클립보드 복사 버튼. 복사 후 잠깐 "복사됨" 상태.
// navigator.clipboard 미지원 환경 폴백은 생략 — 대상은 최신 브라우저.
// ponytail: execCommand 폴백 생략(대상=Claude Code 사용자=최신 브라우저). 승급=폴백 추가.

// 퍼널 추적(선택) — track이 있으면 복사 성공 시에만 /api/funnel-event로 fire-and-forget 전송.
// 프라이버시 우선: IP·쿠키·UA 없음(sendBeacon, 본문은 event/name뿐). track 없으면 동작 변화 0.
export type CopyTrack = { event: "install_copy" | "prompt_copy" | "mcp_copy"; name?: string };

// 추적 전송은 어떤 이유로도 복사를 방해하면 안 된다 → 전 과정을 try로 감싸 에러를 전부 삼킨다.
function fireTrack(track: CopyTrack) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const body = new Blob([JSON.stringify({ event: track.event, name: track.name })], { type: "application/json" });
    navigator.sendBeacon("/api/funnel-event", body);
  } catch {
    // 추적 실패는 조용히 무시(복사 UX 최우선).
  }
}

export default function CopyButton({
  text,
  label = "복사",
  copiedLabel = "복사됨",
  className = "",
  track,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  track?: CopyTrack;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      if (track) fireTrack(track); // 복사 성공 후에만 추적(실패 시 아래 catch로 빠져 미전송)
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
