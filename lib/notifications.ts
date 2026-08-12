import { prisma } from "@/lib/prisma";
import { KST_DUE_DAY_END_OFFSET_MS } from "@/lib/priority";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1시간에 한 번만 점검
const NOTIFICATION_RETENTION_DAYS = 30;

// 기한 임박(D-1)·지연 알림 — 별도 스케줄러 없이 로그인 사용자가 대시보드를 볼 때
// 본인 프로젝트만 lazy하게 점검한다. 동일 타입+프로젝트당 한 번만 생성(중복 방지).
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
      if (!t.dueDate) return null;
      const dueEnd = t.dueDate.getTime() + KST_DUE_DAY_END_OFFSET_MS;
      if (dueEnd < now) return { project: t, type: "OVERDUE", message: `"${t.title}" 프로젝트가 지연되었습니다.` };
      if (dueEnd - now <= 24 * 60 * 60 * 1000) return { project: t, type: "DUE_SOON", message: `"${t.title}" 프로젝트 기한이 임박했습니다(D-1).` };
      return null;
    })
    .filter((c) => c !== null);

  if (candidates.length > 0) {
    const existing = await prisma.notification.findMany({
      where: {
        userId,
        refId: { in: candidates.map((c) => c.project.id) },
        type: { in: ["OVERDUE", "DUE_SOON"] },
      },
      select: { refId: true, type: true },
    });
    const existingKeys = new Set(existing.map((n) => `${n.type}:${n.refId}`));

    const toCreate = candidates.filter((c) => !existingKeys.has(`${c.type}:${c.project.id}`));
    if (toCreate.length > 0) {
      await prisma.notification.createMany({
        data: toCreate.map((c) => ({
          userId,
          type: c.type,
          refId: c.project.id,
          message: c.message,
        })),
      });
    }
  }

  const retentionCutoff = new Date(now - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.notification.deleteMany({
    where: { userId, isRead: true, createdAt: { lt: retentionCutoff } },
  });

  // update가 아니라 updateMany를 쓴다. 세션은 살아있는데 계정이 삭제된 경우
  // update는 레코드를 못 찾아 예외를 던지고, 그 예외가 대시보드 전체를 500으로
  // 무너뜨렸다. 알림 점검 시각 기록은 실패해도 무방한 부수 작업이므로 조용히 넘어간다.
  await prisma.user.updateMany({ where: { id: userId }, data: { lastDeadlineCheckAt: new Date(now) } });
}
