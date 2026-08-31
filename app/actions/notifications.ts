"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
// refId를 화면 주소로 바꾸는 규칙은 웹 푸시와 같아야 한다 — 벨과 푸시가 서로 다른
// 화면으로 보내면 안 되므로 lib/notify.ts의 것을 그대로 쓴다.
import { notificationHrefs } from "@/lib/notify";

export async function listMyNotifications() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const hrefs = await notificationHrefs(notifications);
  return notifications.map((n, i) => ({ ...n, href: hrefs[i] }));
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
