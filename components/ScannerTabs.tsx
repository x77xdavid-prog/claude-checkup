"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import type { Dict } from "@/lib/i18n";

// 스캐너 실행 원라이너를 PowerShell/bash 탭으로 보여주고 복사 제공.
// 단일 파일(checkup.mjs)을 내려받아 실행 — prebuild가 scanner/checkup.mjs를 public/으로 복사해 /checkup.mjs로 서빙. 명령은 로케일 무관, 탭 라벨·복사·aria만 번역.

const SNIPPETS = {
  powershell: {
    label: "PowerShell",
    code: "iwr https://claudecowork.co.kr/checkup.mjs -OutFile checkup.mjs; node checkup.mjs",
  },
  bash: {
    label: "bash / zsh",
    code: "curl -fsSL https://claudecowork.co.kr/checkup.mjs -o checkup.mjs && node checkup.mjs",
  },
} as const;

type TabKey = keyof typeof SNIPPETS;

export default function ScannerTabs({ dict }: { dict: Dict }) {
  const [tab, setTab] = useState<TabKey>("powershell");
  const active = SNIPPETS[tab];

  return (
    <div className="paper-card rounded-lg">
      {/* 탭 헤더 */}
      <div
        role="tablist"
        aria-label={dict.scanner.tablistLabel}
        className="flex items-center gap-1 border-b border-[var(--line-strong)] px-3 pt-2"
      >
        {(Object.keys(SNIPPETS) as TabKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-t-md px-3 py-1.5 font-mono text-sm transition-colors ${
              tab === k
                ? "bg-[var(--paper-2)] text-ink"
                : "text-[var(--ink-faint)] hover:text-[var(--ink-soft)]"
            }`}
          >
            {SNIPPETS[k].label}
          </button>
        ))}
      </div>

      {/* 코드 블록 */}
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <code className="overflow-x-auto whitespace-pre font-mono text-sm text-ink sm:text-base">
          <span className="mr-2 select-none text-[var(--accent)]">$</span>
          {active.code}
        </code>
        <CopyButton text={active.code} label={dict.scanner.copy} copiedLabel={dict.scanner.copied} className="shrink-0" />
      </div>
    </div>
  );
}
