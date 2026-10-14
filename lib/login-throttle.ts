// 로그인 시도 제한. 공개 주소에 아이디·비밀번호 로그인뿐이라, 이게 없으면 비밀번호를
// 끝없이 대입해 볼 수 있다.
//
// 계정 단위로 센다: 연속 5번 틀리면 15분 동안 그 계정은 맞는 비밀번호로도 들어갈 수 없다.
// 15분이 지나면 다시 5번의 기회가 생기고, 한 번 성공하면 처음부터 다시 센다.
// 없는 계정은 세지 않는다 — 뚫을 것이 없고, 기록할 행도 없다.
//
// prisma를 쓰지 않는 순수 함수라 npm run check:login 에서 그대로 확인한다. DB에 쓰는 일은
// auth.ts가 한다.

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export function isLoginLocked(lockedUntil: Date | null, now: number): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now;
}

// 실패 횟수는 DB에서 바로 1을 더하고(increment) 그 결과를 여기에 넘긴다. 읽은 값에
// 더해서 쓰면 동시에 들어온 시도끼리 같은 값을 덮어써 횟수가 덜 세어진다 — 한꺼번에
// 대입하는 공격이 정확히 그 모양이다.
//
// 한도에 닿으면 잠글 시각을 돌려준다(이때 횟수는 0으로 되돌린다 — 잠금이 풀리면 다시
// 5번의 기회가 있다). 아직이면 null.
export function lockAfterFailure(failureCount: number, now: number): Date | null {
  return failureCount >= MAX_LOGIN_FAILURES ? new Date(now + LOGIN_LOCK_MS) : null;
}

export const LOGIN_LOCKED_MESSAGE = `비밀번호를 ${MAX_LOGIN_FAILURES}번 잘못 입력해 ${
  LOGIN_LOCK_MS / 60000
}분 동안 로그인이 잠겼습니다. 잠시 후 다시 시도하거나 관리자에게 비밀번호 초기화를 요청하세요.`;
