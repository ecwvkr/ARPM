import { prisma } from "@/lib/prisma";
import { sweepDeadlineNotifications } from "@/lib/notifications";
import { deleteGoogleEventsById } from "@/lib/google/calendar";
import { trashPurgeCutoff } from "@/lib/trash";

// 하루 한 번 할 일을 모두 여기서 한다(vercel.json의 crons). 무료 플랜은 크론이 2개까지라
// 일마다 경로를 나누지 않는다 — 이름은 처음 붙인 대로 deadlines다.
//   1. 기한 임박·지연·내일 캘린더 일정 알림 + 읽은 지 30일 지난 알림 정리
//      (기한 알림이 만들어지는 곳은 여기뿐이다)
//   2. 보관한 지 30일 지난 파트너·프로젝트 영구 삭제
// 스케줄은 02:00 UTC = 한국시간 오전 11시.
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
  const trash = await purgeExpiredTrash(Date.now());
  return Response.json({ ok: true, ...result, trash });
}

// 보관함 자동 비우기. 규칙(30일, 시작일 유예)은 lib/trash.ts에 있고 보관함 화면도 같은
// 규칙으로 남은 날짜를 보여 준다.
//
// 보관된 것만 지운다. 손으로 영구 삭제할 때는 하위 트리를 통째로 지우지만, 여기서는
// 보관함에 들어 있는 행만 지운다 — 보관한 프로젝트 아래에서 나중에 하위만 복구했다면 그
// 하위는 살아 있는 데이터이고, 상위가 지워지면 최상위로 올라올 뿐이다(parentId SetNull).
// 보관할 때 하위 트리 전체가 같은 시각을 받으므로, 함께 보관된 하위는 함께 지워진다.
// 파트너를 지우면 그 안의 프로젝트·공지·바로가기·채팅방은 cascade로 함께 사라진다.
async function purgeExpiredTrash(now: number) {
  const cutoff = trashPurgeCutoff(now);
  if (!cutoff) return { partners: 0, projects: 0 };

  const partnerIds = (
    await prisma.partner.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true } })
  ).map((p) => p.id);

  // 구글로 내보낸 일정은 행이 사라지면 다시 찾을 수 없으니 먼저 모은다. 지워지는 파트너
  // 안의 프로젝트(보관되지 않았어도 cascade로 사라진다)까지 포함한다.
  const exported = await prisma.project.findMany({
    where: {
      googleEventId: { not: null },
      OR: [{ deletedAt: { lte: cutoff } }, { partnerId: { in: partnerIds } }],
    },
    select: { googleEventId: true },
  });

  const [projects, partners] = await prisma.$transaction([
    prisma.project.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }),
  ]);

  await deleteGoogleEventsById(exported.map((p) => p.googleEventId!));
  return { partners: partners.count, projects: projects.count };
}
