// 로그인 시도 제한 규칙(lib/login-throttle.ts)을 확인한다. 실행:
//   npm run check:login
//
// auth.ts는 실패할 때마다 DB에서 횟수를 1 올리고(increment) 그 값을 lockAfterFailure에
// 넘긴다. 여기서는 그 흐름을 메모리에서 그대로 흉내 내 "몇 번째에 잠기는가", "잠긴 동안
// 맞는 비밀번호도 막히는가", "풀린 뒤 다시 5번인가"를 본다.
//
// 순수 함수만 본다 — DB도 브라우저도 필요 없다(CI에서도 돈다).
import {
  isLoginLocked,
  lockAfterFailure,
  MAX_LOGIN_FAILURES,
  LOGIN_LOCK_MS,
} from "../lib/login-throttle";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

// auth.ts의 authorize를 메모리 위에서 그대로 따라 한다.
type Account = { failedLoginCount: number; loginLockedUntil: Date | null };
function attempt(acc: Account, passwordOk: boolean, now: number): "ok" | "wrong" | "locked" {
  if (isLoginLocked(acc.loginLockedUntil, now)) return "locked";
  if (!passwordOk) {
    acc.failedLoginCount += 1; // DB의 increment
    const lockUntil = lockAfterFailure(acc.failedLoginCount, now);
    if (lockUntil) {
      acc.failedLoginCount = 0;
      acc.loginLockedUntil = lockUntil;
      return "locked";
    }
    return "wrong";
  }
  acc.failedLoginCount = 0;
  acc.loginLockedUntil = null;
  return "ok";
}

function main() {
  const t0 = Date.UTC(2026, 9, 14, 3, 0, 0);

  check("한도는 5회, 잠금은 15분", MAX_LOGIN_FAILURES === 5 && LOGIN_LOCK_MS === 15 * 60 * 1000);

  // 1~4번째 실패는 그냥 실패, 5번째에 잠긴다.
  const a: Account = { failedLoginCount: 0, loginLockedUntil: null };
  const results = Array.from({ length: 5 }, () => attempt(a, false, t0));
  check("4번째까지는 '틀림'", results.slice(0, 4).every((r) => r === "wrong"), results.join(","));
  check("5번째 실패에서 잠긴다", results[4] === "locked");
  check("잠기면 횟수는 0으로", a.failedLoginCount === 0);

  // 잠긴 동안에는 맞는 비밀번호도 막는다 — 안 그러면 잠김/통과로 정답이 드러난다.
  check("잠긴 직후 맞는 비밀번호도 거절", attempt(a, true, t0 + 1000) === "locked");
  check("14분 59초 뒤에도 거절", attempt(a, true, t0 + LOGIN_LOCK_MS - 1000) === "locked");
  // 잠긴 동안의 시도는 횟수를 올리지 않는다(비밀번호를 비교조차 안 한다).
  check("잠긴 동안의 시도는 세지 않는다", a.failedLoginCount === 0);

  // 15분이 지나면 다시 5번의 기회.
  const t1 = t0 + LOGIN_LOCK_MS + 1;
  check("15분 뒤에는 잠금이 풀린다", !isLoginLocked(a.loginLockedUntil, t1));
  const again = Array.from({ length: 4 }, () => attempt(a, false, t1));
  check("풀린 뒤 4번 더 틀려도 아직 안 잠긴다", again.every((r) => r === "wrong"));
  check("풀린 뒤 5번째에 다시 잠긴다", attempt(a, false, t1) === "locked");

  // 성공하면 처음부터 다시 센다.
  const b: Account = { failedLoginCount: 0, loginLockedUntil: null };
  attempt(b, false, t0); attempt(b, false, t0); attempt(b, false, t0); attempt(b, false, t0);
  check("4번 틀린 뒤 성공", attempt(b, true, t0) === "ok");
  check("성공하면 횟수 초기화", b.failedLoginCount === 0);
  check("성공 뒤 다시 4번 틀려도 안 잠긴다",
    [1, 2, 3, 4].map(() => attempt(b, false, t0)).every((r) => r === "wrong"));

  // 한도 이상으로 들어온 값(동시 시도로 increment가 한도를 넘긴 경우)도 잠근다.
  check("한도를 넘긴 횟수도 잠근다", lockAfterFailure(MAX_LOGIN_FAILURES + 2, t0) !== null);
  check("한도 미만은 안 잠근다", lockAfterFailure(MAX_LOGIN_FAILURES - 1, t0) === null);

  check("잠금 시각이 없으면 안 잠김", !isLoginLocked(null, t0));

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main();
