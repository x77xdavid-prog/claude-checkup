// ── 가이드 전용 레이아웃 뼈대 — page.tsx가 800줄 한도에 걸려 분리(같은 페이지에서 갈라져 나간 GuideIcon.tsx와 동일한 관례).
// 마크업·클래스는 이동 전 page.tsx의 것을 그대로 옮긴 것이라 렌더 결과는 동일하다. page.tsx는 이제 콘텐츠만 갖는다.
// 정책 페이지(privacy·terms·rubric·source-policy)는 각자 로컬 Block 사본을 쓰는 기존 관례를 그대로 둔다 — 여기 Block은 가이드 몫.

// 대단원(기초/중급/고급/Q&A) — 정책 페이지의 KO/EN 구분선 패턴을 그대로 사용(구분선 + 아이브로 + 큰 h2 + 본문).
export function Tier({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-[var(--space-section)] scroll-mt-24 border-t border-[var(--line-strong)] pt-10">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-faint)]">{eyebrow}</p>
      <h2 className="font-serif text-title font-black text-ink">{title}</h2>
      <p className="mt-3 leading-relaxed text-[var(--ink-soft)]">{intro}</p>
      {children}
    </section>
  );
}

// 소단원 제목(h3) + 선택적 우측 라벨. id를 주면 페이지 내 앵커(#terminal 등)로 점프 가능.
export function Sub({ title, note, id }: { title: React.ReactNode; note?: string; id?: string }) {
  return (
    <h3 id={id} className="mt-8 flex flex-wrap items-baseline gap-x-2 scroll-mt-24 font-serif text-heading font-bold text-ink">
      <span>{title}</span>
      {note ? (
        <span className="font-mono text-[11px] font-normal uppercase tracking-wider text-[var(--ink-faint)]">
          {note}
        </span>
      ) : null}
    </h3>
  );
}

// 용어 → 설명 2열 행(명령어·스킬·설정 목록). term은 <code> 또는 라벨.
export function Row({ term, children }: { term: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[minmax(0,9.5rem)_1fr] sm:gap-4">
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="text-[var(--ink-soft)]">{children}</dd>
    </div>
  );
}

// 외부 저장소 행 — 스킬이 아니라 별도 앱·자료라 설치 명령 대신 저장소 링크로만 보낸다(고급편 Orca 블록과 같은 규칙).
// meta는 실측한 라이선스 등 사실만. 확인 못 한 항목은 비워두고 지어내지 않는다.
export function Ext({
  name,
  repo,
  meta,
  children,
}: {
  name: string;
  repo: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <Row term={name}>
      {children}{" "}
      {meta ? <>{meta} · </> : null}
      <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="link-ink">
        {repo} ↗
      </a>
    </Row>
  );
}

// 제목 위, 본문 아래로 쌓는 블록(개념 3종·Q&A 문답).
export function Stack({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-serif text-base font-bold text-ink">{title}</p>
      <div className="mt-1 space-y-1 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </div>
  );
}

// 정책 블록 — 제목 h2 + 본문. source-policy·privacy·terms와 동일 패턴(마무리 CTA에 사용).
export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-bold text-ink">{title}</h2>
      <div className="mt-3 leading-relaxed text-[var(--ink-soft)]">{children}</div>
    </section>
  );
}
