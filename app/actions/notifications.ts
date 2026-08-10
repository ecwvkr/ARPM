"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// refId의 의미는 알림 종류마다 다르다: 대부분은 taskId지만, PROJECT_INVITED와
// TASK_DELETED(업무가 이미 삭제됨)는 projectId를 담는다.
const PROJECT_REF_TYPES = new Set(["PROJECT_INVITED", "TASK_DELETED"]);

export async function listMyNotifications() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const taskRefIds = notifications
    .filter((n) => n.refId && !PROJECT_REF_TYPES.has(n.type))
    .map((n) => n.refId!);

  const tasks = taskRefIds.length
    ? await prisma.task.findMany({
        where: { id: { in: taskRefIds } },
        select: { id: true, projectId: true },
      })
    : [];
  const projectIdByTaskId = new Map(tasks.map((t) => [t.id, t.projectId]));

  return notifications.map((n) => {
    let href: string | null = null;
    if (n.refId) {
      if (PROJECT_REF_TYPES.has(n.type)) {
        href = `/projects/${n.refId}`;
      } else {
        const projectId = projectIdByTaskId.get(n.refId);
        if (projectId) href = `/projects/${projectId}?task=${n.refId}`;
      }
    }
    return { ...n, href };
  });
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
}

export async function deleteNotification(id: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await prisma.notification.deleteMany({ where: { id, userId: session.user.id } });
}
