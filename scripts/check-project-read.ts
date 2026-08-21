// 프로젝트 '미확인' 표시(빨간 점) 판정의 근거인 ProjectRead.lastReadAt이 다시 읽을 때마다
// 앞으로 가는지 확인한다. 실행:
//   npm run check:project-read
//
// 주의: DATABASE_URL이 가리키는 DB를 실제로 건드린다. 만든 읽음 기록은 끝나면 원상복구하고,
// 프로젝트/사용자 등 기존 데이터는 만들지도 지우지도 않는다.
import { prisma } from "../lib/prisma";
import { isProjectUnread } from "../lib/priority";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

// 실제 상세 화면(getProjectAccess)이 하는 것과 같은 upsert.
function markRead(projectId: string, userId: string) {
  const lastReadAt = new Date();
  return prisma.projectRead.upsert({
    where: { projectId_userId: { projectId, userId } },
    update: { lastReadAt },
    create: { projectId, userId, lastReadAt },
  });
}

async function main() {
  const project = await prisma.project.findFirstOrThrow({
    where: { deletedAt: null },
    include: { participants: true },
  });
  const userId = project.masterId;
  const key = { projectId_userId: { projectId: project.id, userId } };
  const original = await prisma.projectRead.findUnique({ where: key });

  try {
    await markRead(project.id, userId);
    const first = await prisma.projectRead.findUniqueOrThrow({ where: key });

    // 프로젝트가 수정된 상황을 흉내낸다(updatedAt이 읽은 시각보다 나중).
    const edited = {
      masterId: project.masterId,
      updatedAt: new Date(first.lastReadAt.getTime() + 1000),
      participants: project.participants.map((p) => ({ userId: p.userId })),
      reads: [{ lastReadAt: first.lastReadAt }],
      comments: [],
    };
    check("수정 후에는 미확인으로 뜬다", isProjectUnread(edited, userId));

    await new Promise((r) => setTimeout(r, 1100));
    await markRead(project.id, userId);
    const second = await prisma.projectRead.findUniqueOrThrow({ where: key });
    check("다시 읽으면 lastReadAt이 전진한다", second.lastReadAt > first.lastReadAt,
      `${first.lastReadAt.toISOString()} -> ${second.lastReadAt.toISOString()}`);
    check("다시 읽은 뒤에는 미확인이 사라진다",
      !isProjectUnread({ ...edited, reads: [{ lastReadAt: second.lastReadAt }] }, userId));
  } finally {
    if (original) {
      await prisma.projectRead.update({ where: key, data: { lastReadAt: original.lastReadAt } });
    } else {
      await prisma.projectRead.delete({ where: key }).catch(() => {});
    }
    console.log(`정리: 읽음 기록 ${original ? "원래 값으로 복구" : "삭제"}`);
  }
  console.log(`\n결과: 통과 ${ok} / 실패 ${fail}`);
}

main()
  .catch((e) => { fail++; console.error("스크립트 오류:", e.message); })
  .finally(async () => { await prisma.$disconnect(); process.exit(fail === 0 ? 0 : 1); });
