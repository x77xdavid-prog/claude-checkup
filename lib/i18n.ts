// i18n 코어 — 로케일 목록·사전 로더·타입. 외부 의존성 없음(순수 App Router).
// 사전은 locales/<locale>.json 정적 import. 서버 컴포넌트가 getDict(locale)로 읽어
// 클라이언트 컴포넌트엔 props로 내려준다(컨텍스트 프로바이더 없음 — props가 단순).

import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import zhCN from "@/locales/zh-CN.json";
import zhTW from "@/locales/zh-TW.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import pt from "@/locales/pt.json";
import ru from "@/locales/ru.json";
import hi from "@/locales/hi.json";
import id from "@/locales/id.json";
import vi from "@/locales/vi.json";
import th from "@/locales/th.json";
import tr from "@/locales/tr.json";
import ar from "@/locales/ar.json";

// 확정 16개 로케일. 순서 = 스위처 표시 순서. 기본은 ko.
export const LOCALES = [
  "ko",
  "en",
  "ja",
  "zh-CN",
  "zh-TW",
  "es",
  "fr",
  "de",
  "pt",
  "ru",
  "hi",
  "id",
  "vi",
  "th",
  "tr",
  "ar",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

// RTL 로케일 — [locale] layout이 dir="rtl"을 세팅한다.
const RTL_LOCALES = new Set<Locale>(["ar"]);

// 스위처에 표시할 자국어 언어명.
export const LOCALE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ไทย",
  tr: "Türkçe",
  ar: "العربية",
};

// hreflang/lang 속성용 BCP-47 코드(자기참조 SEO). ko→ko-KR 등.
export const HREFLANG: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en",
  ja: "ja-JP",
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  es: "es",
  fr: "fr",
  de: "de",
  pt: "pt",
  ru: "ru",
  hi: "hi",
  id: "id",
  vi: "vi",
  th: "th",
  tr: "tr",
  ar: "ar",
};

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

// 사전 타입 — ko.json이 진실 소스(모든 키를 가짐). 다른 로케일은 이 형태를 따른다.
export type Dict = typeof ko;

const DICTS: Record<Locale, Dict> = {
  ko,
  en: en as Dict,
  ja: ja as Dict,
  "zh-CN": zhCN as Dict,
  "zh-TW": zhTW as Dict,
  es: es as Dict,
  fr: fr as Dict,
  de: de as Dict,
  pt: pt as Dict,
  ru: ru as Dict,
  hi: hi as Dict,
  id: id as Dict,
  vi: vi as Dict,
  th: th as Dict,
  tr: tr as Dict,
  ar: ar as Dict,
};

// 서버 함수 — 로케일별 사전 반환. 알 수 없으면 기본(ko)로 폴백.
export function getDict(locale: string): Dict {
  return DICTS[locale as Locale] ?? DICTS[DEFAULT_LOCALE];
}

// ── 최소 자가검증 ──────────────────────────────
if (process.env.NODE_ENV !== "production" && require.main === module) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL " + m);
  };
  assert(LOCALES.length === 16, "16개 로케일");
  assert(isLocale("ar") && !isLocale("xx"), "isLocale");
  assert(dirFor("ar") === "rtl" && dirFor("ko") === "ltr", "dir");
  // 모든 로케일이 이름·hreflang·사전을 갖는다
  for (const l of LOCALES) {
    assert(!!LOCALE_NAMES[l], "name " + l);
    assert(!!HREFLANG[l], "hreflang " + l);
    assert(!!DICTS[l], "dict " + l);
  }
  // 모든 사전이 ko와 같은 최상위 키를 갖는다(드리프트 감지)
  const koKeys = Object.keys(ko).sort().join(",");
  for (const l of LOCALES) {
    const k = Object.keys(DICTS[l]).sort().join(",");
    assert(k === koKeys, "키 일치 " + l);
  }
  console.log("i18n.ts self-check OK");
}
