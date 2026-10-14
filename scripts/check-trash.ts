// 보관함 자동 비우기 규칙(lib/trash.ts)을 확인한다. 실행:
//   npm run check:trash
//
// 크론은 trashPurgeCutoff로 지울 대상을 고르고, 보관함 화면은 trashExpiresAt·trashDaysLeft로
// 남은 날짜를 보여 준다. 둘이 같은 날을 가리켜야 한다 — 화면에 "3일 남음"인데 오늘
// 지워지면 안 된다. 기능이 들어오기 전에 보관된 것의 유예도 여기서 본다.
//
// 순수 함수만 본다 — DB도 브라우저도 필요 없다(CI에서도 돈다).
import {
  TRASH_PURGE_START,
  TRASH_RETENTION_DAYS,
  trashExpiresAt,
  trashPurgeCutoff,
  trashDaysLeft,
} from "../lib/trash";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

const DAY = 24 * 60 * 60 * 1000;
const START = TRASH_PURGE_START.getTime();

// 크론이 지우는가: deletedAt <= cutoff
function purged(deletedAt: number, now: number) {
  const cutoff = trashPurgeCutoff(now);
  return cutoff !== null && deletedAt <= cutoff.getTime();
}

function main() {
  check("보관 기간은 30일", TRASH_RETENTION_DAYS === 30);

  // 기능 시작 전에 보관된 것: 시작일부터 센다. 이미 53일 지난 것도 바로 지우지 않는다.
  const old = START - 53 * DAY;
  check("시작 전 보관분은 시작 다음 날 지워지지 않는다", !purged(old, START + 1 * DAY));
  check("시작 전 보관분은 29일째에도 남는다", !purged(old, START + 29 * DAY));
  check("시작 전 보관분은 30일째에 지워진다", purged(old, START + 30 * DAY));
  check("시작 전 보관분의 만료일 = 시작일 + 30일", trashExpiresAt(new Date(old)).getTime() === START + 30 * DAY);
  check("시작 전 보관분, 시작 당일 남은 날짜 30일", trashDaysLeft(new Date(old), START) === 30, `${trashDaysLeft(new Date(old), START)}`);

  // 시작 후에 보관된 것: 보관 시각부터 30일.
  const d = START + 10 * DAY + 5 * 60 * 60 * 1000;
  check("시작 후 보관분은 29일 뒤 남는다", !purged(d, d + 29 * DAY));
  check("시작 후 보관분은 30일 뒤 지워진다", purged(d, d + 30 * DAY));
  check("30일 직전 1분은 남는다", !purged(d, d + 30 * DAY - 60 * 1000));

  // 화면과 크론이 같은 날을 가리키는가 — 여러 시점에서 "지워졌다" ⇔ "남은 날짜 0".
  let consistent = true;
  for (const deletedAt of [old, START - DAY, START, d]) {
    for (let t = START; t < START + 80 * DAY; t += 6 * 60 * 60 * 1000) {
      const expired = trashExpiresAt(new Date(deletedAt)).getTime() <= t;
      if (expired !== purged(deletedAt, t)) consistent = false;
      if (expired && trashDaysLeft(new Date(deletedAt), t) !== 0) consistent = false;
      if (!expired && trashDaysLeft(new Date(deletedAt), t) === 0) consistent = false;
    }
  }
  check("화면의 남은 날짜와 크론의 삭제 판정이 모든 시점에서 일치", consistent);

  check("시작일 전에는 아무것도 지우지 않는다", trashPurgeCutoff(START + 29 * DAY) === null);

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main();
