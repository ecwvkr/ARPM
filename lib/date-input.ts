// <input type="date">의 연도 칸은 브라우저 기본값으로 6자리까지 받는다(달력 표준이
// 275760년까지 다루기 때문). 그래서 "20260904"를 이어서 치면 연도가 202609를 먹고
// 월에 04가 들어가 202609-04-일 같은 값이 만들어진다. 실제로 그런 신고가 있었다.
//
// 여기서 정하는 범위를 두 곳이 함께 쓴다.
//  · 입력칸(components/ui/input.tsx): min/max로 걸어 브라우저가 잘못된 값의 제출을 막는다.
//  · 서버(app/actions/*): 브라우저를 거치지 않은 요청도 있으므로 다시 확인한다.
export const DATE_INPUT_MIN = "2000-01-01";
export const DATE_INPUT_MAX = "2099-12-31";

const MIN_MS = Date.parse(`${DATE_INPUT_MIN}T00:00:00Z`);
const MAX_MS = Date.parse(`${DATE_INPUT_MAX}T00:00:00Z`);

// 날짜 칸에서 온 값을 Date로 바꾼다. 형식이 아니거나 범위 밖이면 null —
// 부르는 쪽에서 "올바른 날짜를 입력하세요"로 되돌려 준다.
export function parseDateInput(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // 연도 4자리를 강제한다. 202609-04-04 같은 값이 여기서 걸린다.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const time = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  if (time < MIN_MS || time > MAX_MS) return null;

  const date = new Date(time);
  // 없는 날짜는 그냥 굴러간다 — 2026-02-30은 3월 2일이 된다. 되돌려 봐서 다른 날이
  // 나오면 거부한다(달력에서 고르면 생길 수 없지만, 직접 친 값은 여기까지 온다).
  if (date.toISOString().slice(0, 10) !== raw) return null;
  return date;
}
