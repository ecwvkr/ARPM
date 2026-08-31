"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pushConfigured, sendPushToUsers } from "@/lib/push";

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

// 설정 화면에서 "이 기기에 잘 오는지" 바로 확인할 수 있게 한다. 기기·브라우저마다
// 권한과 설치 상태가 달라서(특히 아이폰은 홈 화면에 추가해야 온다) 눌러 보는 것 말고는
// 확인할 방법이 마땅치 않다. 본인에게만 보낸다.
export async function sendTestPush() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await sendPushToUsers([session.user.id], {
    title: "AR_PM",
    body: "알림이 정상적으로 도착했습니다.",
    url: "/",
  });
}
