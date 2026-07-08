import type { Dict } from "@/lib/i18n";

// 영역별 레이더 차트 — 인라인 SVG(외부 라이브러리 0). 서버 컴포넌트·정적.
// 좌표: 각도 = i/n*2π − π/2(12시 시작, 시계방향), 반지름 = value/100 * R.
// 격자 4겹(25/50/75/100%) + 축 스포크 + 라벨. 잉크 스트로크 + 주황 채움.

export interface RadarAxis {
  label: string;
  value: number; // 0~100
}

const CX = 240;
const CY = 200;
const R = 120;
const RINGS = [0.25, 0.5, 0.75, 1];

function clamp(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
}

// i번째 축, 중심에서 radius만큼 떨어진 점. 12시(-90°)부터 시계방향.
function point(i: number, n: number, radius: number): [number, number] {
  const a = (i / n) * 2 * Math.PI - Math.PI / 2;
  return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
}

// n각형 points 문자열. radiusAt(i)로 축별 반지름 지정(격자=고정, 값=점수비례).
function polygon(n: number, radiusAt: (i: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = point(i, n, radiusAt(i));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export default function RadarChart({ axes, dict }: { axes: RadarAxis[]; dict: Dict }) {
  const n = axes.length;
  if (n < 3) return null; // 레이더는 최소 3축이라야 면이 생긴다

  return (
    <section aria-labelledby="radar-heading" className="paper-card rounded-xl px-5 py-6 sm:px-8 sm:py-7">
      <h2 id="radar-heading" className="mb-4 font-serif text-xl text-ink">
        {dict.result.radarTitle}
      </h2>
      <svg viewBox="0 0 480 400" className="mx-auto block h-auto w-full max-w-md" role="img" aria-label={dict.result.radarTitle}>
        {RINGS.map((f) => (
          <polygon key={f} points={polygon(n, () => f * R)} fill="none" stroke="var(--line-strong)" strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, n, R);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
        })}
        <polygon
          points={polygon(n, (i) => (clamp(axes[i].value) / 100) * R)}
          fill="var(--accent)"
          fillOpacity={0.2}
          stroke="var(--ink)"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
        {axes.map((a, i) => {
          const [x, y] = point(i, n, (clamp(a.value) / 100) * R);
          return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--accent-ink)" />;
        })}
        {axes.map((a, i) => {
          const [x, y] = point(i, n, R + 16);
          const dx = x - CX;
          const anchor = Math.abs(dx) < 12 ? "middle" : dx > 0 ? "start" : "end";
          return (
            <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="font-mono" style={{ fontSize: "9px", fill: "var(--ink-soft)" }}>
              {a.label}
            </text>
          );
        })}
      </svg>
    </section>
  );
}
