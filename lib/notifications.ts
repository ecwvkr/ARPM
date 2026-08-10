import { prisma } from "@/lib/prisma";
import { KST_DUE_DAY_END_OFFSET_MS } from "@/lib/priority";

// 기한 임박(D-1)·지연 알림 — 별도 스케줄러 없이 로그인 사용자가 대시보드를 볼 때
// 본인 업무만 lazy하게 점검한다. 동일 타입+업무당 한 번만 생성(중복 방지).
export async function ensureDeadlineNotifications(userId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { not: null },
      OR: [{ masterId: userId }, { participants: { some: { userId } } }],
    },
    select: { id: true, title: true, dueDate: true },
  });

  if (tasks.length === 0) return;

  const now = Date.now();

  const candidates = tasks
    .map((t) => {
      if (!t.dueDate) return null;
      const dueEnd = t.dueDate.getTime() + KST_DUE_DAY_END_OFFSET_MS;
      if (dueEnd < now) return { task: t, type: "OVERDUE", message: `"${t.title}" 업무가 지연되었습니다.` };
      if (dueEnd - now <= 24 * 60 * 60 * 1000) return { task: t, type: "DUE_SOON", message: `"${t.title}" 업무 기한이 임박했습니다(D-1).` };
      return null;
    })
    .filter((c) => c !== null);

  if (candidates.length === 0) return;

  const existing = await prisma.notification.findMany({
    where: {
      userId,
      refId: { in: candidates.map((c) => c.task.id) },
      type: { in: ["OVERDUE", "DUE_SOON"] },
    },
    select: { refId: true, type: true },
  });
  const existingKeys = new Set(existing.map((n) => `${n.type}:${n.refId}`));

  const toCreate = candidates.filter((c) => !existingKeys.has(`${c.type}:${c.task.id}`));
  if (toCreate.length === 0) return;

  await prisma.notification.createMany({
    data: toCreate.map((c) => ({
      userId,
      type: c.type,
      refId: c.task.id,
      message: c.message,
    })),
  });
}
