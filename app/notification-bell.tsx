import { listMyNotifications } from "@/app/actions/notifications";
import { NotificationBellClient } from "./notification-bell-client";

// 알림 목록을 페이지 렌더에 얹어서 내려준다. 예전에는 클라이언트가 마운트될 때마다
// listMyNotifications를 한 번 더 호출해, 페이지를 옮기는 횟수만큼 Vercel 함수 호출이
// 늘었다(무료 플랜의 병목은 호출 수와 CPU 시간이다). 서버 렌더는 어차피 도는 것이므로
// 여기서 함께 읽으면 추가 호출이 0이 된다.
export async function NotificationBell() {
  return <NotificationBellClient initial={await listMyNotifications()} />;
}
