import { prisma } from "@/lib/prisma";
import { KST_DUE_DAY_END_OFFSET_MS } from "@/lib/priority";
import { pushNotifications, type NotifyItem } from "@/lib/notify";
import { getSyncedGoogleEvents, seoulDateKey } from "@/lib/google/calendar";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간에 한 번만 점검
const NOTIFICATION_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

// 기한 하나를 놓고 "지연" / "임박(D-1)" / 해당 없음을 가른다. 기준 시각은 한국시간
// 그날 23:59:59.999다(KST_DUE_DAY_END_OFFSET_MS) — 서버 타임존과 무관하게 같은 판정이
// 나와야 하기 때문. 순수 함수라 npm run check:deadline에서 경계값을 직접 확인한다.
export function classifyDeadline(
  dueDate: Date | null,
  now: number,
): "OVERDUE" | "DUE_SOON" | null {
  if (!dueDate) return null;
  const dueEnd = dueDate.getTime() + KST_DUE_DAY_END_OFFSET_MS;
  if (dueEnd < now) return "OVERDUE";
  if (dueEnd - now <= DAY_MS) return "DUE_SOON";
  return null;
}

// 한 사람 몫의 기한 임박(D-1)·지연 점검. 아직 없는 알림만 만들고, 새로 만든 것을
// 돌려준다 — 푸시를 보낼지는 부르는 쪽이 정한다. 같은 타입+프로젝트당 한 번만 만든다.
async function scanDeadlines(userId: string, now: number): Promise<NotifyItem[]> {
  const projects = await prisma.project.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { not: null },
      OR: [{ masterId: userId }, { participants: { some: { userId } } }],
    },
    select: { id: true, title: true, dueDate: true },
  });

  const candidates = projects
    .map((t) => {
      const type = classifyDeadline(t.dueDate, now);
      if (!type) return null;
      const message =
        type === "OVERDUE"
          ? `"${t.title}" 프로젝트가 지연되었습니다.`
          : `"${t.title}" 프로젝트 기한이 임박했습니다(D-1).`;
      return { project: t, type, message };
    })
    .filter((c) => c !== null);

  if (candidates.length === 0) return [];

  const existing = await prisma.notification.findMany({
    where: {
      userId,
      refId: { in: candidates.map((c) => c.project.id) },
      type: { in: ["OVERDUE", "DUE_SOON"] },
    },
    select: { refId: true, type: true },
  });
  const existingKeys = new Set(existing.map((n) => `${n.type}:${n.refId}`));

  const created = candidates
    .filter((c) => !existingKeys.has(`${c.type}:${c.project.id}`))
    .map((c) => ({ userId, type: c.type, refId: c.project.id, message: c.message }));

  if (created.length > 0) await prisma.notification.createMany({ data: created });
  return created;
}

// 대시보드를 열 때 도는 lazy 점검. 크론(sweepDeadlineNotifications)이 하루 한 번 도는
// 것과 별개로, 크론이 못 돌거나 그 사이에 기한이 넘어간 경우를 위한 안전망이다.
// 여기서는 푸시를 보내지 않는다 — 이 사람은 지금 화면을 보고 있어서 벨로 충분하다.
// 매 로드마다 다시 훑지 않도록 User.lastDeadlineCheckAt으로 쓰로틀하고, 같은 주기에
// 읽은 지 오래된 알림도 함께 정리한다.
export async function ensureDeadlineNotifications(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDeadlineCheckAt: true },
  });
  const now = Date.now();
  if (user?.lastDeadlineCheckAt && now - user.lastDeadlineCheckAt.getTime() < CHECK_INTERVAL_MS) {
    return;
  }

  await scanDeadlines(userId, now);

  const retentionCutoff = new Date(now - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.notification.deleteMany({
    where: { userId, isRead: true, createdAt: { lt: retentionCutoff } },
  });

  // update가 아니라 updateMany를 쓴다. 세션은 살아있는데 계정이 삭제된 경우
  // update는 레코드를 못 찾아 예외를 던지고, 그 예외가 대시보드 전체를 500으로
  // 무너뜨렸다. 알림 점검 시각 기록은 실패해도 무방한 부수 작업이므로 조용히 넘어간다.
  await prisma.user.updateMany({ where: { id: userId }, data: { lastDeadlineCheckAt: new Date(now) } });
}

// 크론(매일 한국시간 오전 11시)에서 도는 전체 점검. 대시보드를 열지 않아도 기한 알림이 가야
// 하므로 여기서는 푸시까지 보낸다 — 앱을 열어야만 오는 알림은 마감 알림으로서
// 쓸모가 없다.
//
// 대시보드 lazy 점검이 이미 만든 알림은 여기서 다시 만들지 않으므로 푸시도 가지
// 않는다. 화면에서 이미 본 것을 다시 울릴 이유가 없으니 그대로 둔다.
export async function sweepDeadlineNotifications() {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  const now = Date.now();

  let created = 0;
  for (const user of users) {
    const items = await scanDeadlines(user.id, now);
    if (items.length === 0) continue;
    created += items.length;
    pushNotifications(items);
  }

  // 내일 있는 캘린더 일정도 같은 주기에 알린다. 구글 조회는 사용자마다 하는 게 아니라
  // 앱 전체가 한 연결을 공유하므로 한 번만 돈다.
  const calendarItems = await scanCalendarEvents(now);
  if (calendarItems.length > 0) pushNotifications(calendarItems);

  return { users: users.length, created, calendar: calendarItems.length };
}

// 캘린더 일정 알림 ---------------------------------------------------------
// 구글 캘린더는 앱 전체가 한 연결(GoogleConnection)을 공유하고, 관리자가 고른 캘린더가
// 모든 사용자에게 똑같이 보인다. 그래서 일정 알림도 전원에게 같은 내용으로 나간다.

// "9월 1일" 꼴. 일정 알림 문구에 쓴다. 서버가 UTC로 돌아도 한국 날짜가 나오도록
// 한국 기준 날짜 키에서 뽑는다.
function eventDateLabel(date: Date) {
  const [, month, day] = seoulDateKey(date).split("-").map(Number);
  return `${month}월 ${day}일`;
}

async function activeUserIds(exceptUserId?: string) {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
  return users.map((u) => u.id).filter((id) => id !== exceptUserId);
}

// 일정을 새로 추가했을 때. 추가한 본인은 뺀다.
export async function notifyCalendarEventAdded(
  eventId: string,
  title: string,
  startDate: Date,
  createdByUserId: string,
) {
  const userIds = await activeUserIds(createdByUserId);
  if (userIds.length === 0) return;

  const items = userIds.map((userId) => ({
    userId,
    type: "CALENDAR_EVENT_ADDED",
    refId: eventId,
    message: `${eventDateLabel(startDate)}에 "${title}" 일정이 추가됐습니다.`,
  }));
  await prisma.notification.createMany({ data: items });
  pushNotifications(items);
}

// 내일 시작하는 일정(D-1). 크론에서 하루 한 번 돈다. 같은 일정에 두 번 가지 않도록
// 프로젝트 기한 알림과 같은 방식(타입+refId)으로 이미 보낸 것을 걸러낸다.
async function scanCalendarEvents(now: number): Promise<NotifyItem[]> {
  // 조회 창은 넉넉히 잡고, 어떤 날 일정인지는 한국 기준 날짜 키로 고른다.
  // startDate를 timestamp로 비교하면 안 된다 — 종일 일정과 시간 지정 일정이 서로 다른
  // 기준으로 만들어져서, 시간 지정 일정이 통째로 걸러지는 일이 실제로 있었다.
  const events = await getSyncedGoogleEvents(new Date(now - DAY_MS), new Date(now + 3 * DAY_MS));
  const tomorrowKey = seoulDateKey(new Date(now + DAY_MS));
  const starting = events.filter((e) => seoulDateKey(e.startDate) === tomorrowKey);
  if (starting.length === 0) return [];

  const userIds = await activeUserIds();
  const existing = await prisma.notification.findMany({
    where: { type: "CALENDAR_DUE_SOON", refId: { in: starting.map((e) => e.id) } },
    select: { userId: true, refId: true },
  });
  const sent = new Set(existing.map((n) => `${n.userId}:${n.refId}`));

  const items: NotifyItem[] = [];
  for (const event of starting) {
    for (const userId of userIds) {
      if (sent.has(`${userId}:${event.id}`)) continue;
      items.push({
        userId,
        type: "CALENDAR_DUE_SOON",
        refId: event.id,
        message: `내일(${eventDateLabel(event.startDate)}) "${event.title}" 일정이 있습니다.`,
      });
    }
  }

  if (items.length > 0) await prisma.notification.createMany({ data: items });
  return items;
}
