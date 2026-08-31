// 기한 임박(D-1)·지연 판정의 경계값을 확인한다. 실행:
//   npm run check:deadline
//
// 기준은 한국시간 그날 23:59:59.999다. 서버 타임존(Vercel은 UTC)과 무관하게 같은
// 판정이 나와야 해서, dueDate에 고정 오프셋을 더해 계산한다. 그 계산이 하루 경계에서
// 어긋나면 마감 하루 전에 "지연" 알림이 가거나 지난 기한이 조용히 넘어간다.
//
// DB를 건드리지 않는다 — 순수 함수만 본다.
import { classifyDeadline } from "../lib/notifications";
import { KST_DUE_DAY_END_OFFSET_MS } from "../lib/priority";
import { seoulDateKey } from "../lib/google/calendar";

let ok = 0, fail = 0;
function check(label: string, got: string | null, want: string | null) {
  if (got === want) { ok++; console.log("  OK  ", label, `-> ${got ?? "해당 없음"}`); }
  else { fail++; console.log("  FAIL", label, `-> ${got ?? "해당 없음"} (기대: ${want ?? "해당 없음"})`); }
}

const DAY = 24 * 60 * 60 * 1000;

function main() {
  // <input type="date">가 저장하는 모양 그대로: 그 날짜의 UTC 자정.
  const due = new Date("2026-09-01T00:00:00.000Z");
  const dueEnd = due.getTime() + KST_DUE_DAY_END_OFFSET_MS; // 한국시간 9/1 23:59:59.999

  check("기한 당일 마지막 순간", classifyDeadline(due, dueEnd), "DUE_SOON");
  check("기한 1ms 지남", classifyDeadline(due, dueEnd + 1), "OVERDUE");
  check("기한 하루 뒤", classifyDeadline(due, dueEnd + DAY), "OVERDUE");

  check("남은 시간 정확히 24시간", classifyDeadline(due, dueEnd - DAY), "DUE_SOON");
  check("남은 시간 24시간 + 1ms", classifyDeadline(due, dueEnd - DAY - 1), null);
  check("남은 시간 사흘", classifyDeadline(due, dueEnd - 3 * DAY), null);

  check("기한 없음", classifyDeadline(null, Date.now()), null);

  // 서버가 UTC든 KST든 같은 답이 나와야 한다 — 판정에 로컬 타임존이 끼어들면 안 된다.
  const noon = new Date("2026-09-01T12:00:00.000Z").getTime();
  const before = process.env.TZ;
  process.env.TZ = "UTC";
  const utc = classifyDeadline(due, noon);
  process.env.TZ = "Asia/Seoul";
  const kst = classifyDeadline(due, noon);
  process.env.TZ = before;
  check("타임존이 판정을 바꾸지 않음", utc, kst);

  // 캘린더 일정의 "같은 날인가" 판정.
  // NormalizedGoogleEvent.startDate는 종일 일정과 시간 지정 일정이 서로 다른 방식으로
  // 만들어진다 — 종일은 서버 로컬 자정, 시간 지정은 한국 날짜의 UTC 자정. 예전에는 이
  // 둘을 timestamp로 바로 비교해서 시간 지정 일정이 통째로 걸러졌다(실제 일정 3건 중
  // 0건 선택). 날짜 키로 비교하면 두 방식 모두 같은 날로 잡힌다.
  const allDayStyle = new Date("2026-08-21T00:00:00"); // 서버 로컬 자정
  const timedStyle = new Date(Date.UTC(2026, 7, 21)); // 한국 날짜의 UTC 자정
  check("종일 일정의 날짜 키", seoulDateKey(allDayStyle), "2026-08-21");
  check("시간 지정 일정의 날짜 키", seoulDateKey(timedStyle), "2026-08-21");
  check("두 방식이 같은 날로 잡힌다", seoulDateKey(allDayStyle), seoulDateKey(timedStyle));

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main();
