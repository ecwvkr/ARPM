"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// refId의 의미는 알림 종류마다 다르다: 대부분은 projectId지만, PARTNER_INVITED와
// PROJECT_ARCHIVED(프로젝트가 보관함으로 이동해 일반 조회에서 사라짐)는 partnerId를 담는다.
const PARTNER_REF_TYPES = new Set(["PARTNER_INVITED", "PROJECT_ARCHIVED", "CHAT_MENTION"]);

export async function listMyNotifications() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const projectRefIds = notifications
    .filter((n) => n.refId && !PARTNER_REF_TYPES.has(n.type))
    .map((n) => n.refId!);

  const projects = projectRefIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectRefIds } },
        select: { id: true, partnerId: true },
      })
    : [];
  const partnerIdByProjectId = new Map(projects.map((t) => [t.id, t.partnerId]));

  return notifications.map((n) => {
    let href: string | null = null;
    if (n.refId) {
      if (PARTNER_REF_TYPES.has(n.type)) {
        href = `/partners/${n.refId}`;
      } else {
        const partnerId = partnerIdByProjectId.get(n.refId);
        if (partnerId) href = `/partners/${partnerId}?project=${n.refId}`;
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
