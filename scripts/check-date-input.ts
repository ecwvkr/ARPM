// 날짜 입력 칸의 방어선을 확인한다. 실행:
//   npm run check:date-input
//
// <input type="date">의 연도 칸은 브라우저 기본값으로 6자리까지 받는다. "20260904"를
// 이어서 치면 연도가 202609를 먹고 202609-04-04 같은 값이 만들어지는데, 범위를 걸지
// 않으면 브라우저가 이걸 정상으로 보고 그대로 제출한다(실측: valid=true). 그러면 서기
// 202609년짜리 프로젝트가 저장된다.
//
// 막는 곳이 둘이다.
//  · 입력칸 — 공용 Input이 type="date"에 min/max를 걸어 브라우저가 제출을 막는다.
//  · 서버 — parseDateInput이 형식과 범위를 다시 본다(브라우저를 안 거친 요청도 있다).
//
// 파일만 읽는다 — DB도 브라우저도 필요 없다.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseDateInput, DATE_INPUT_MIN, DATE_INPUT_MAX } from "../lib/date-input";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

function main() {
  // --- 서버 쪽 판별 ---
  check("정상 날짜", parseDateInput("2026-09-04")?.toISOString().slice(0, 10) === "2026-09-04");
  // 신고된 바로 그 값.
  check("6자리 연도 거부", parseDateInput("202609-04-04") === null);
  check("범위 아래 거부", parseDateInput("1999-12-31") === null);
  check("범위 위 거부", parseDateInput("2100-01-01") === null);
  check("범위 경계는 통과", !!parseDateInput(DATE_INPUT_MIN) && !!parseDateInput(DATE_INPUT_MAX));
  check("빈 값은 null", parseDateInput("") === null && parseDateInput(null) === null);
  check("형식 아닌 값 거부", parseDateInput("2026-9-4") === null && parseDateInput("2026/09/04") === null);
  check("없는 날짜 거부", parseDateInput("2026-02-30") === null, "2026-02-30");
  // 시간대와 무관하게 그 날짜여야 한다(서버는 UTC로 돈다).
  check("자정 UTC로 고정", parseDateInput("2026-09-04")?.toISOString() === "2026-09-04T00:00:00.000Z");

  // --- 화면 쪽: 날짜 칸이 전부 공용 Input을 거치는지 ---
  // 원시 <input type="date">를 쓰면 min/max가 안 붙어 다시 뚫린다.
  const files = [...walk("app"), ...walk("components")];
  const raw: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // 여는 태그 이름과 그 안의 type="date"를 함께 본다([\s\S]로 줄바꿈까지 넘긴다).
    for (const match of text.matchAll(/<(\w+)[^<>]*?type="date"/g)) {
      if (match[1] !== "Input") raw.push(`${file}: <${match[1]}>`);
    }
  }
  check("모든 날짜 칸이 공용 Input을 쓴다", raw.length === 0, raw.join(", "));

  const inputSource = readFileSync(join("components", "ui", "input.tsx"), "utf8");
  check("공용 Input이 날짜 범위를 건다",
    inputSource.includes("DATE_INPUT_MIN") && inputSource.includes("DATE_INPUT_MAX"));

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main();
