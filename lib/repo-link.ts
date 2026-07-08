// 카탈로그 항목의 원저장소(GitHub) URL 도출 — 순수 함수, 외부 의존 없음.
// 정직 원칙: 출처를 실제로 확인할 수 있을 때만 링크를 만든다(추측 URL 금지).
// source "external:<owner>/<repo>" → 그 repo 그대로.
// source "plugin:<market>"이고 install2.command에 "/plugin marketplace add github.com/<owner>/<repo>"
// 줄이 있으면 그 repo(마켓에 공개 repo가 확인된 경우만 — lib/install-command.ts MARKET_REPOS 참고).
// 그 외(local 등)는 null — CatalogBrowser가 null이면 링크 자체를 렌더링하지 않는다.

const MARKETPLACE_ADD_RE = /\/plugin marketplace add github\.com\/(\S+)/;

export function repoUrlFor(entry: { source?: string; install2?: { command?: string | null } }): string | null {
  const source = entry.source;
  if (!source) return null;

  if (source.startsWith("external:")) {
    const slug = source.slice("external:".length).trim();
    return slug ? `https://github.com/${slug}` : null;
  }

  if (source.startsWith("plugin:")) {
    const command = entry.install2?.command;
    if (typeof command === "string") {
      const m = command.match(MARKETPLACE_ADD_RE);
      if (m) return `https://github.com/${m[1]}`;
    }
    return null;
  }

  return null;
}

// ── 최소 자가검증 (직접 실행 시에만; import 시엔 실행 안 됨) ──
if (
  process.env.NODE_ENV !== "production" &&
  typeof process !== "undefined" &&
  (process.argv[1] ?? "").replace(/\\/g, "/").endsWith("/lib/repo-link.ts")
) {
  const assert = (c: boolean, m: string) => {
    if (!c) throw new Error("FAIL " + m);
  };
  const ext = repoUrlFor({ source: "external:alirezarezvani/claude-skills" });
  assert(ext === "https://github.com/alirezarezvani/claude-skills", "external → repo URL 직결");

  const mp = repoUrlFor({
    source: "plugin:gptaku-plugins",
    install2: { command: "/plugin marketplace add github.com/fivetaku/gptaku_plugins\n/plugin install dd@gptaku-plugins" },
  });
  assert(mp === "https://github.com/fivetaku/gptaku_plugins", "plugin marketplace add 라인 파싱");

  const loc = repoUrlFor({
    source: "local",
    install2: { command: "/plugin marketplace add coreyhaines31/marketingskills\n/plugin install marketing-skills@marketingskills" },
  });
  assert(loc === null, "local 등 그 외 소스는 null");

  console.log("repo-link.ts self-check OK");
}
