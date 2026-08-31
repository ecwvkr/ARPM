// 공지 권한 규칙(lib/notices.ts)이 의도대로 갈리는지 확인한다. 실행:
//   npm run check:notice
//
// 실제 DB의 사용자·파트너로 판정만 돌려보고, 만든 공지는 끝나면 지운다.
// 기존 공지/사용자/파트너는 건드리지 않는다.
import { prisma } from "../lib/prisma";
import { getNoticeAccess, listNotices } from "../lib/notices";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, isSuperAdmin: true } });
  const partners = await prisma.partner.findMany({ where: { deletedAt: null }, include: { members: true } });
  const isOutsider = (p: (typeof partners)[number], u: (typeof users)[number]) =>
    !u.isSuperAdmin && p.ownerId !== u.id && !p.members.some((m) => m.userId === u.id);
  // 미참여자 차단까지 실제로 확인할 수 있는 파트너를 고른다.
  const partner =
    partners.find((p) => users.some((u) => isOutsider(p, u))) ?? partners[0];
  if (!partner) throw new Error("확인할 파트너가 없습니다.");

  const admin = users.find((u) => u.isSuperAdmin);
  const memberIds = new Set([partner.ownerId, ...partner.members.map((m) => m.userId)]);
  const member = users.find((u) => !u.isSuperAdmin && memberIds.has(u.id));
  const outsider = users.find((u) => !u.isSuperAdmin && !memberIds.has(u.id));

  console.log(`파트너 "${partner.name}" 기준`);

  // 전체공지: 누구나 보고, 총관리자만 쓴다.
  for (const u of users) {
    const a = await getNoticeAccess(null, u.id, u.isSuperAdmin);
    check(`전체공지 조회: ${u.name}`, a.canView);
    check(`전체공지 작성: ${u.name}`, a.canManage);
  }

  // 파트너 공지: 참여자만 보고 고친다.
  if (member) {
    const a = await getNoticeAccess(partner.id, member.id, false);
    check(`파트너 공지 참여자(${member.name}) 조회`, a.canView);
    check(`파트너 공지 참여자(${member.name}) 관리`, a.canManage);
  } else {
    console.log("  SKIP 파트너 참여자 없음");
  }
  if (outsider) {
    const a = await getNoticeAccess(partner.id, outsider.id, false);
    check(`파트너 공지 미참여자(${outsider.name}) 차단`, !a.canView && !a.canManage);
  } else {
    console.log("  SKIP 미참여자 없음");
  }
  if (admin) {
    const a = await getNoticeAccess(partner.id, admin.id, true);
    check(`파트너 공지 총관리자(${admin.name}) 관리`, a.canManage);
  }

  // 목록이 소속별로 갈리는지 — 전체공지가 파트너 탭에 새어 나오면 안 된다.
  const author = admin ?? users[0];
  const created = await prisma.$transaction([
    prisma.notice.create({ data: { partnerId: null, title: "[점검] 전체", body: "x", createdById: author.id } }),
    prisma.notice.create({ data: { partnerId: partner.id, title: "[점검] 파트너", body: "x", createdById: author.id } }),
  ]);
  try {
    const global = await listNotices(null);
    const scoped = await listNotices(partner.id);
    check("전체공지 목록에 파트너 공지 없음", !global.some((n) => n.id === created[1].id));
    check("파트너 공지 목록에 전체공지 없음", !scoped.some((n) => n.id === created[0].id));
    check("최신순 정렬", global.length < 2 || global[0].createdAt >= global[1].createdAt);
    check("작성자 이름이 실림", scoped.find((n) => n.id === created[1].id)?.createdByName === author.name);
    check("수정 전에는 수정자 없음", scoped.find((n) => n.id === created[1].id)?.updatedByName === null);
  } finally {
    await prisma.notice.deleteMany({ where: { id: { in: created.map((n) => n.id) } } });
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
