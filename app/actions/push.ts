"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured } from "@/lib/push";

export async function getPushStatus() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  return { configured: pushConfigured, deviceCount: count };
}

// 브라우저가 만든 구독 정보를 그대로 저장한다. endpoint가 곧 기기 식별자라
// 같은 기기에서 다시 구독하면 덮어쓴다.
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (!sub.endpoint.startsWith("https://") || !sub.p256dh || !sub.auth) {
    throw new Error("구독 정보가 올바르지 않습니다.");
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: session.user.id, p256dh: sub.p256dh, auth: sub.auth },
    create: { userId: session.user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
  });
}

export async function removePushSubscription(endpoint: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // 남의 구독을 지울 수 없도록 본인 것만 지운다.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
}
