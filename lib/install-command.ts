// 스킬 설치 명령 도출 (정직 원칙) — 순수 함수. 빌드 스크립트가 단일 진실 소스로 재사용.
// build-catalog.mjs가 Node24 타입-스트리핑으로 이 .ts를 직접 import → @/ 별칭·외부 의존 금지
// (상대 경로·순수 TS만). CatalogBrowser는 Install2 "타입만" import(런타임 미포함, install2는 빌드 시 선계산).

export type InstallKind = "marketplace" | "verified-repo" | "unverified";

// data/provenance.json 항목 형태(부분). verified===true + install 있으면 원클릭 가능.
export interface ProvenanceEntry {
  repo?: string | null;
  method?: string;
  install?: string;
  license?: string;
  verified?: boolean;
}

export interface Install2 {
  kind: InstallKind;
  command: string | null; // null = 원클릭 불가(출처 미확인)
  note?: string;
  license?: string; // verified-repo일 때 표시
  alternatives?: string[]; // unverified: 같은 category verified 스킬 이름(최대 2)
}

export interface InstallOpts {
  prov?: ProvenanceEntry | null;
  pluginName?: string; // marketplace: 실제 플러그인명(스킬명과 다를 수 있음 — 예: analysis→insane-design)
  alternatives?: string[]; // unverified 대안 후보(caller가 category 내 설치가능 목록 제공)
}

// 마켓 → 실제 공개 repo (실측). 없는 마켓은 repo 미확인 → note로 정직하게 표기.
export const MARKET_REPOS: Record<string, string> = {
  "gptaku-plugins": "github.com/fivetaku/gptaku_plugins",
  ponytail: "github.com/x77xdavid-prog/ponytail",
  thedotmack: "github.com/thedotmack/claude-mem",
  "understand-anything": "github.com/Lum1104/Understand-Anything",
  // claude-plugins-official: 공개 repo 미확인 → note 처리(아래)
};

const UNVERIFIED_NOTE = "출처 미확인 — 원클릭 설치 불가. 이름으로 검색해 직접 설치하세요.";

// name+source(+opts)로 정직한 설치 결과 도출. 추측성 명령을 만들지 않는다(command=null 허용).
export function installFor(name: string, source: string, opts: InstallOpts = {}): Install2 {
  // 1) 마켓플레이스 설치 항목 — plugin:<마켓>
  if (source.startsWith("plugin:")) {
    const market = source.slice("plugin:".length);
    const plugin = opts.pluginName && opts.pluginName.trim() ? opts.pluginName.trim() : name;
    const installLine = `/plugin install ${plugin}@${market}`;
    const repo = MARKET_REPOS[market];
    if (!repo) {
      // repo 미확인(예: claude-plugins-official) — add 라인 제공 불가. install 라인 + 안내.
      return {
        kind: "marketplace",
        command: installLine,
        note: `이 마켓('${market}')의 공개 repo가 확인되지 않아 자동 추가 명령을 제공할 수 없습니다. 마켓을 먼저 등록한 뒤 설치하세요.`,
      };
    }
    return { kind: "marketplace", command: `/plugin marketplace add ${repo}\n${installLine}` };
  }

  // 2) 로컬 + 출처 검증됨 → provenance.install (npx skills add … 형식)
  const prov = opts.prov;
  if (source === "local" && prov && prov.verified === true && typeof prov.install === "string" && prov.install.trim()) {
    const out: Install2 = { kind: "verified-repo", command: prov.install };
    if (prov.license && prov.license !== "unknown") out.license = prov.license;
    return out;
  }

  // 3) 그 외(verified 아님/unknown) — 원클릭 불가 + 같은 category 대안 2개.
  return {
    kind: "unverified",
    command: null,
    note: UNVERIFIED_NOTE,
    alternatives: (opts.alternatives ?? []).slice(0, 2),
  };
}

// ── 최소 자가검증 (직접 실행 시에만; import 시엔 실행 안 됨 → 빌드 스크립트 안전) ──
if (
  process.env.NODE_ENV !== "production" &&
  typeof process !== "undefined" &&
  (process.argv[1] ?? "").replace(/\\/g, "/").endsWith("/lib/install-command.ts")
) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL " + m);
  };
  const mp = installFor("analysis", "plugin:gptaku-plugins", { pluginName: "insane-design" });
  assert(
    mp.kind === "marketplace" &&
      mp.command === "/plugin marketplace add github.com/fivetaku/gptaku_plugins\n/plugin install insane-design@gptaku-plugins",
    "marketplace 2줄 + 실제 플러그인명",
  );
  const off = installFor("access", "plugin:claude-plugins-official", { pluginName: "imessage" });
  assert(off.kind === "marketplace" && off.command === "/plugin install imessage@claude-plugins-official" && !!off.note, "repo 미확인 마켓 → note");
  const ver = installFor("agent-browser", "local", {
    prov: { verified: true, install: "npx skills add https://github.com/x/y --skill agent-browser", license: "Apache-2.0" },
  });
  assert(ver.kind === "verified-repo" && ver.command === "npx skills add https://github.com/x/y --skill agent-browser" && ver.license === "Apache-2.0", "verified-repo + license");
  const verNoLic = installFor("z", "local", { prov: { verified: true, install: "npx skills add z", license: "unknown" } });
  assert(verNoLic.license === undefined, "unknown 라이선스는 표시 안 함");
  const unv = installFor("foo", "local", { prov: { verified: false }, alternatives: ["a", "b", "c"] });
  assert(unv.kind === "unverified" && unv.command === null && (unv.alternatives ?? []).length === 2, "unverified + 대안 2개");
  const unv2 = installFor("bar", "local", {});
  assert(unv2.kind === "unverified" && unv2.command === null, "prov 없음 → unverified");
  console.log("install-command.ts self-check OK");
}
