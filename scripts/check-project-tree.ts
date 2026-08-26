// 프로젝트 트리의 전제를 확인한다: parentId는 항상 같은 파트너 안의 프로젝트를 가리킨다.
// lib/projects.ts의 트리 조회(hasInheritedAccess, filterVisibleProjects)가 파트너 단위로
// 프로젝트를 읽어 조상을 거슬러 올라가므로, 이 전제가 깨지면 상속 권한 판정이 조용히
// 틀어진다. 소속 파트너 변경(updateProjectInfo)이 하위 트리를 통째로 옮기는 이유다. 실행:
//   npm run check:tree
//
// 읽기만 한다 — 아무것도 만들거나 지우지 않는다. 보관함(deletedAt)에 있는 것도 함께 본다.
import { prisma } from "../lib/prisma";

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, title: true, parentId: true, partnerId: true, partner: { select: { name: true } } },
  });
  const byId = new Map(projects.map((p) => [p.id, p]));

  let fail = 0;
  for (const p of projects) {
    if (!p.parentId) continue;
    const parent = byId.get(p.parentId);
    if (!parent) {
      fail++;
      console.log(`  FAIL "${p.title}": 상위 프로젝트(${p.parentId})가 없음`);
    } else if (parent.partnerId !== p.partnerId) {
      fail++;
      console.log(
        `  FAIL "${p.title}"(${p.partner.name}) -> 상위 "${parent.title}"(${parent.partner.name}): 파트너가 다름`,
      );
    }
  }

  console.log(`\n${projects.length}건 중 ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
