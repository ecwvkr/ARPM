"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function listMyNotifications() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
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
