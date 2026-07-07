"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

// 스캐너 실행 원라이너를 PowerShell/bash 탭으로 보여주고 복사 제공.
// 스펙: 원격 원라이너는 P2 배포 후. 오늘은 로컬 실행 안내 형태(node scanner/checkup.mjs).

const SNIPPETS = {
  powershell: {
    label: "PowerShell",
    // 로컬 저장소에서 스캐너 실행. 원격 배포 전까지 clone 후 실행 안내.
    code: "node scanner/checkup.mjs",
  },
  bash: {
    label: "bash / zsh",
    code: "node scanner/checkup.mjs",
  },
} as const;

type TabKey = keyof typeof SNIPPETS;

export default function ScannerTabs() {
  const [tab, setTab] = useState<TabKey>("powershell");
  const active = SNIPPETS[tab];

  return (
    <div className="paper-card rounded-lg">
      {/* 탭 헤더 */}
      <div
        role="tablist"
        aria-label="스캐너 실행 명령"
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
        <CopyButton text={active.code} label="복사" className="shrink-0" />
      </div>
    </div>
  );
}
