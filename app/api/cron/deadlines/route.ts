import { sweepDeadlineNotifications } from "@/lib/notifications";

// 기한 임박·지연 알림을 매일 한 번 전체 사용자에 대해 점검한다(vercel.json의 crons).
// 스케줄은 02:00 UTC = 한국시간 오전 11시.
// 대시보드를 열 때 도는 점검만으로는 앱을 열어야만 알림이 생겨서, 정작 마감을 놓친
// 사람에게는 아무것도 가지 않는다.
//
// 크론은 로그인 세션이 없으므로 proxy.ts의 로그인 검사에서 제외돼 있다. 대신 여기서
// Vercel이 붙여 주는 CRON_SECRET을 직접 확인한다. 키가 없으면 전부 거절한다(열어두는
// 것보다 안 도는 편이 낫다).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await sweepDeadlineNotifications();
  return Response.json({ ok: true, ...result });
}
