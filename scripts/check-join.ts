// 카드의 '참여하기' 버튼(lib/priority.ts의 canJoinProject)과 서버의 참여 허용
// (lib/projects.ts의 getProjectAccess().canJoin)이 같은 판정을 내리는지 확인한다.
// 둘이 어긋나면 버튼은 보이는데 눌러도 서버가 거절하는 상태가 된다. 실행:
//   npm run check:join
//
// 읽기만 한다 — 아무것도 만들거나 지우지 않는다.
import { prisma } from "../lib/prisma";
import { getProjectAccess } from "../lib/projects";
import { canJoinProject } from "../lib/priority";
import { getPartnerAccess } from "../lib/permissions";

let ok = 0, fail = 0;

async function main() {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true, title: true, partnerId: true, masterId: true, completedAt: true,
        participants: { select: { userId: true } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, isSuperAdmin: true } }),
  ]);

  for (const user of users) {
    // 파트너 참여 여부는 사용자마다 한 번만 조회해 재사용한다.
    const memberOf = new Map<string, boolean>();
    for (const partnerId of new Set(projects.map((p) => p.partnerId))) {
      memberOf.set(partnerId, (await getPartnerAccess(partnerId, user.id, user.isSuperAdmin)).isMember);
    }

    for (const project of projects) {
      const shown = canJoinProject(project, user.id, memberOf.get(project.partnerId)!);
      const { canJoin, canView } = await getProjectAccess(project.id, user.id, user.isSuperAdmin);
      // 목록에 아예 안 뜨는(=볼 수 없는) 프로젝트는 버튼도 없으므로 비교 대상이 아니다.
      if (!canView) continue;
      if (shown === canJoin) { ok++; continue; }
      fail++;
      console.log(`  FAIL "${project.title}" / ${user.name}: 버튼=${shown} 서버=${canJoin}`);
    }
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
