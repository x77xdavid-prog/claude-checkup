"use client";

import { useState } from "react";

// 이메일 구독 폼. 허니팟 필드(website) 포함 — 봇이 채우면 서버가 조용히 무시.
// 상태: idle | loading | ok | error.

type State = "idle" | "loading" | "ok" | "error";

export default function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // 허니팟
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("ok");
        setMsg("등록되었습니다. 클로드 뉴스레터를 보내드릴게요.");
        setEmail("");
      } else {
        setState("error");
        setMsg(data?.error ?? "등록에 실패했습니다. 잠시 후 다시 시도하세요.");
      }
    } catch {
      setState("error");
      setMsg("네트워크 오류. 잠시 후 다시 시도하세요.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      {/* 허니팟: 사람에겐 숨김, 봇은 채움. autocomplete off + aria-hidden + tabindex -1 */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden" style={{ position: "absolute" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row"}>
        <label className="sr-only" htmlFor="sub-email">
          이메일 주소
        </label>
        <input
          id="sub-email"
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-4 py-3 font-mono text-ink placeholder:text-[var(--ink-faint)]"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="btn-accent shrink-0 rounded-md px-6 py-3 font-semibold disabled:opacity-60"
        >
          {state === "loading" ? "등록 중…" : "무료 구독"}
        </button>
      </div>

      <p
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] text-sm ${
          state === "error" ? "text-[var(--accent-ink)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {msg || (compact ? "" : "일 1회 클로드 소식. 언제든 해지 가능.")}
      </p>
    </form>
  );
}
