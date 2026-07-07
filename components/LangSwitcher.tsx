"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";

// 언어 스위처 — 현재 경로의 로케일 세그먼트만 교체하고 이동한다.
// select 드롭다운(네이티브, 의존성 0). 접근성: aria-label은 dict에서 받는다.
export default function LangSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function swapLocale(next: string): string {
    // pathname 예: /en/catalog → /ja/catalog. 첫 세그먼트가 로케일이면 교체, 아니면 접두.
    const segs = pathname.split("/");
    if ((LOCALES as readonly string[]).includes(segs[1])) {
      segs[1] = next;
    } else {
      segs.splice(1, 0, next);
    }
    const joined = segs.join("/");
    return joined || `/${next}`;
  }

  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={locale}
        onChange={(e) => router.push(swapLocale(e.target.value))}
        className="rounded-md border-[1.5px] border-[var(--line-strong)] bg-[var(--paper)] px-2 py-1 font-mono text-xs text-ink"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
