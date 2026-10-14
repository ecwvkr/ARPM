// 보관함 자동 비우기 규칙. 보관한 지 30일이 지난 파트너·프로젝트는 매일 크론이 영구 삭제한다
// (app/api/cron/deadlines). 보관함에는 쌓이기만 하고 지워지지 않았다.
//
// prisma를 쓰지 않는 순수 모듈이다 — 보관함 화면(클라이언트)이 "N일 후 삭제"를 계산할 때도
// 같은 규칙을 쓴다. 화면의 날짜와 실제 삭제일이 어긋나면 안 된다. npm run check:trash.

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// 이 기능이 들어오기 전에 보관된 것은 이 날부터 센다. 그냥 보관 시각부터 세면 배포 다음 날
// 아침, 이미 30일이 넘은 보관 항목(당시 4건)이 아무 예고 없이 지워진다. 그 사이에 보관함을
// 열어 남은 날짜를 보고 필요한 것을 복구할 수 있게 한다.
export const TRASH_PURGE_START = new Date("2026-10-14T00:00:00+09:00");

// 이 항목이 영구 삭제되는 시각.
export function trashExpiresAt(deletedAt: Date): Date {
  const from = Math.max(deletedAt.getTime(), TRASH_PURGE_START.getTime());
  return new Date(from + TRASH_RETENTION_DAYS * DAY_MS);
}

// 크론이 지울 대상: deletedAt이 이 시각 이전인 것. 아직 아무것도 지울 때가 아니면 null.
// trashExpiresAt(d) <= now 와 같은 조건을 쿼리 한 줄로 쓸 수 있게 바꾼 것이다.
export function trashPurgeCutoff(now: number): Date | null {
  const cutoff = now - TRASH_RETENTION_DAYS * DAY_MS;
  return cutoff >= TRASH_PURGE_START.getTime() ? new Date(cutoff) : null;
}

// 보관함 화면 표기용. 오늘 지워질 예정이면 0.
export function trashDaysLeft(deletedAt: Date, now: number): number {
  return Math.max(0, Math.ceil((trashExpiresAt(deletedAt).getTime() - now) / DAY_MS));
}
