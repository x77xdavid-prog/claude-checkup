"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dict, Locale } from "@/lib/i18n";

// 1분 시작 + 레벨 테스트 — 3단계 클라이언트 위저드.
// Step1: 개발자/터미널 예·아니오(워밍업). Step2: 5문항 자가체크(순차 게이팅, 처음 '아니오'에서 멈춤).
// Step3: 레벨 + 처방 3장(모두 실존 라우트). 결과 도달 시 /api/funnel-event로 start_level 비콘 1회.
// 레벨 = 앞에서부터 연속 '예' 개수(0~5 → Lv.0~4, ⑤까지 전부 예면 Lv.4). 가짜 통계·백분위 없음.

type Phase = "q1" | "quiz" | "result";
type LevelKey = "lv0" | "lv1" | "lv2" | "lv3" | "lv4";

const QUESTION_COUNT = 5;

// 추적 비콘 — 복사 버튼과 별개로 인라인(요청대로 CopyButton 리팩터 금지).
// 어떤 이유로도 위저드를 방해하면 안 되므로 전 과정을 try로 감싸 에러를 삼킨다.
function fireStartLevel(level: number) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const body = new Blob([JSON.stringify({ event: "start_level", name: `lv${level}` })], { type: "application/json" });
    navigator.sendBeacon("/api/funnel-event", body);
  } catch {
    // 추적 실패는 조용히 무시(위저드 UX 최우선).
  }
}

export default function StartWizard({ dict, locale }: { dict: Dict; locale: Locale }) {
  const s = dict.start;
  const [phase, setPhase] = useState<Phase>("q1");
  const [noTerminal, setNoTerminal] = useState(false); // step1에서 '아니오'면 안심 문구 표시
  const [quizIndex, setQuizIndex] = useState(0);
  const [level, setLevel] = useState(0);

  // 처방 카드 링크 — 전부 실존 라우트(/prompts·/guide·/catalog·/#my-score·/whats-new.xml).
  const rxHref: Record<number, [string, string, string]> = {
    0: [`/${locale}/prompts`, `/${locale}/guide#basics`, `/${locale}#subscribe`],
    1: [`/${locale}/guide#basics`, `/${locale}/catalog`, `/${locale}/prompts`],
    2: [`/${locale}#my-score`, `/${locale}/catalog`, `/${locale}/guide#intermediate`],
    3: [`/${locale}/guide#intermediate`, `/${locale}/catalog?q=workflow`, `/${locale}#my-score`],
    4: [`/whats-new.xml`, `/${locale}/catalog?q=${encodeURIComponent("오케스트레이션")}`, `/${locale}#my-score`],
  };

  function goResult(lv: number) {
    const capped = Math.min(lv, 4);
    setLevel(capped);
    setPhase("result");
    fireStartLevel(capped); // 결과 도달 시 정확히 1회
  }

  // step2 답변: 순차 게이팅. '아니오' → 앞선 '예' 개수(=quizIndex)가 레벨. '예' → 다음, 마지막이면 Lv.4.
  function answer(yes: boolean) {
    if (!yes) {
      goResult(quizIndex);
      return;
    }
    if (quizIndex === QUESTION_COUNT - 1) {
      goResult(QUESTION_COUNT); // 전부 예 → cap 4
      return;
    }
    setQuizIndex((i) => i + 1);
  }

  function back() {
    if (quizIndex === 0) {
      setPhase("q1");
      return;
    }
    setQuizIndex((i) => i - 1);
  }

  function restart() {
    setPhase("q1");
    setNoTerminal(false);
    setQuizIndex(0);
    setLevel(0);
  }

  return (
    <div className="mt-8 max-w-2xl">
      {phase === "q1" && (
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">{s.q1Title}</h2>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">{s.q1Note}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <BigChoice
              label={s.q1Yes}
              onClick={() => {
                setNoTerminal(false);
                setPhase("quiz");
              }}
            />
            <BigChoice
              label={s.q1No}
              onClick={() => {
                setNoTerminal(true);
                setPhase("quiz");
              }}
            />
          </div>
        </div>
      )}

      {phase === "quiz" && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-bold text-ink">{s.q2Title}</h2>
            <span className="font-mono text-xs text-[var(--ink-faint)]">
              {quizIndex + 1} / {QUESTION_COUNT}
            </span>
          </div>
          <p className="text-sm text-[var(--ink-soft)]">{s.q2Sub}</p>
          {noTerminal && (
            <p className="mt-3 rounded-lg border-l-4 border-[var(--accent)] bg-[var(--paper-2)] px-4 py-2.5 text-sm leading-relaxed text-ink">
              {s.noTerminalReassure}
            </p>
          )}

          {/* 진행 막대 */}
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper-2)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${((quizIndex + 1) / QUESTION_COUNT) * 100}%` }}
            />
          </div>

          <div className="paper-card mt-6 rounded-xl px-6 py-8">
            <p className="font-mono text-xs text-[var(--ink-faint)]">Q{quizIndex + 1}</p>
            <p className="mt-2 font-serif text-xl font-semibold text-ink">{s.questions[quizIndex]}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => answer(true)} className="btn-accent rounded-md px-6 py-3 font-semibold">
                {s.yes}
              </button>
              <button type="button" onClick={() => answer(false)} className="btn-ghost rounded-md px-6 py-3 font-medium">
                {s.no}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={back}
            className="mt-5 font-mono text-sm text-[var(--ink-soft)] underline transition-opacity hover:opacity-70"
          >
            ← {s.back}
          </button>
        </div>
      )}

      {phase === "result" && (
        <Result
          dict={dict}
          level={level}
          hrefs={rxHref[level]}
          onRestart={restart}
        />
      )}
    </div>
  );
}

function BigChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="paper-card rounded-xl px-6 py-8 text-left font-serif text-lg font-semibold text-ink transition-transform hover:-translate-y-0.5 hover:text-[var(--accent-ink)]"
    >
      {label}
    </button>
  );
}

function Result({
  dict,
  level,
  hrefs,
  onRestart,
}: {
  dict: Dict;
  level: number;
  hrefs: [string, string, string];
  onRestart: () => void;
}) {
  const s = dict.start;
  const key = (`lv${level}` as LevelKey);
  const lv = s.levels[key];
  const cards = s.rx[key];

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{s.resultEyebrow}</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="stamp h-16 w-16 shrink-0 font-serif text-3xl font-black" aria-hidden>
          {level}
        </span>
        <div>
          <p className="font-mono text-xs text-[var(--ink-faint)]">Lv.{level}</p>
          <h2 className="font-serif text-3xl font-black text-ink">{lv.name}</h2>
        </div>
      </div>
      <p className="mt-3 max-w-xl leading-relaxed text-[var(--ink-soft)]">{lv.desc}</p>

      <h3 className="mt-8 font-serif text-xl font-bold text-ink">{s.rxHeading}</h3>
      <ul className="mt-4 grid gap-4">
        {cards.map((c, i) => (
          <RxCard key={i} href={hrefs[i]} title={c.title} desc={c.desc} n={i + 1} />
        ))}
      </ul>

      <button
        type="button"
        onClick={onRestart}
        className="mt-8 font-mono text-sm text-[var(--ink-soft)] underline transition-opacity hover:opacity-70"
      >
        ↺ {s.restart}
      </button>
    </div>
  );
}

// 처방 카드 — 종이 카드 + 번호 + 제목 + 설명. .xml(피드)만 일반 앵커, 내부 라우트는 next/link.
function RxCard({ href, title, desc, n }: { href: string; title: string; desc: string; n: number }) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0 font-mono text-sm text-[var(--accent)]">{n}</span>
      <span className="min-w-0">
        <span className="block font-serif text-lg font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--ink-soft)]">{desc}</span>
      </span>
      <span className="ml-auto shrink-0 self-center text-[var(--accent)]" aria-hidden>
        →
      </span>
    </>
  );
  const cls =
    "paper-card flex items-start gap-3 rounded-lg px-5 py-4 transition-transform hover:-translate-y-0.5";
  // whats-new.xml은 라우트 핸들러(페이지 아님) → 일반 앵커. 나머지는 SPA 내비.
  if (href.includes(".xml")) {
    return (
      <li>
        <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={cls}>
        {inner}
      </Link>
    </li>
  );
}
