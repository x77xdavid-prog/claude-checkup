// usecases skillNames 실존 검증 + matchUsecase 스모크. 빌드 게이트용.
// 실행: node scripts/verify-usecases.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = JSON.parse(readFileSync(path.join(root, "public", "catalog.json"), "utf-8"));
const names = new Set(catalog.map((s) => s.name));

// usecases.ts는 TS라 직접 import 불가 → 정규식으로 skillNames 배열만 추출해 검사.
const src = readFileSync(path.join(root, "lib", "usecases.ts"), "utf-8");
const blocks = [...src.matchAll(/skillNames:\s*\[([^\]]*)\]/g)].map((m) =>
  [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
);

let missing = 0;
let thin = 0;
blocks.forEach((arr, i) => {
  const bad = arr.filter((n) => !names.has(n));
  if (bad.length) {
    missing += bad.length;
    console.error(`[MISSING] block #${i}: ${bad.join(", ")}`);
  }
  const live = arr.filter((n) => names.has(n));
  if (live.length < 2) {
    thin++;
    console.error(`[THIN] block #${i} has <2 live skills: [${arr.join(", ")}]`);
  }
});

if (missing === 0 && thin === 0) {
  console.log(`OK: ${blocks.length} usecases, all skillNames exist in catalog (${names.size} skills), each >=2 live`);
  process.exit(0);
} else {
  console.error(`FAIL: missing=${missing}, thin=${thin}`);
  process.exit(1);
}
