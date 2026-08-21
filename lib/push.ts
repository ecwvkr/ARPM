import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID는 "이 서버가 보낸 게 맞다"를 브라우저 푸시 서비스에 증명하는 열쇠 한 쌍이다.
// 외부 유료 서비스 없이 무료로 푸시를 보낼 수 있는 표준 방식이고, 키가 없으면
// 푸시만 조용히 꺼진다(대화 자체는 그대로 동작해야 한다).
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

export const pushConfigured = Boolean(publicKey && privateKey);
if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!);
}

export type PushPayload = { title: string; body: string; url: string };

// 구독은 기기·브라우저마다 하나씩이라 한 사람이 여러 개를 가질 수 있다.
// 410/404는 "그 구독은 이제 없다"는 뜻이므로 그 자리에서 정리한다.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!pushConfigured || userIds.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
      ),
    ),
  );

  const dead = subs
    .filter((_, i) => {
      const r = results[i];
      if (r.status !== "rejected") return false;
      const status = (r.reason as { statusCode?: number })?.statusCode;
      return status === 404 || status === 410;
    })
    .map((s) => s.id);

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }
}

export function sendChatPush(userIds: string[], title: string, body: string) {
  return sendPushToUsers(userIds, { title, body, url: "/?chat=1" }).catch(() => {
    // 푸시 실패가 메시지 전송을 되돌리게 두지 않는다.
  });
}
