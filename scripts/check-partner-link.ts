// 파트너 바로가기 링크 카드를 확인한다. 실행:
//   npm run check:partner-link
//
// 카드 전체가 <a href>라, 저장되는 주소가 곧 눌렀을 때 가는 곳이다. javascript: 같은
// 주소가 저장되면 누른 사람 브라우저에서 그대로 실행되므로, 주소 검사가 이 기능의
// 방어선이다. 권한은 파트너 공지와 같은 규칙을 쓴다(그 파트너 참여자만).
//
// 만든 링크는 끝나면 지운다. 기존 데이터는 건드리지 않는다.
import { prisma } from "../lib/prisma";
import { listPartnerLinks } from "../lib/partner-links";
import { getNoticeAccess } from "../lib/notices";
import { normalizeLink } from "../lib/normalize";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

async function main() {
  // --- 주소 검사(액션이 저장 전에 통과시키는 것과 같은 함수) ---
  check("스킴 없이 적으면 https를 붙인다", normalizeLink("example.com/a") === "https://example.com/a");
  check("http는 그대로", normalizeLink("http://example.com/") === "http://example.com/");
  // 이게 통과하면 카드를 누른 사람 브라우저에서 코드가 실행된다.
  check("javascript: 거부", normalizeLink("javascript:alert(1)") === undefined);
  check("data: 거부", normalizeLink("data:text/html,<script>") === undefined);
  check("주소가 아닌 글 거부", normalizeLink("구현모 링크") === undefined);
  check("빈 값은 null", normalizeLink("") === null && normalizeLink(null) === null);

  // --- 권한: 공지와 같은 규칙 ---
  const users = await prisma.user.findMany({ select: { id: true, name: true, isSuperAdmin: true } });
  const partners = await prisma.partner.findMany({ where: { deletedAt: null }, include: { members: true } });
  const isOutsider = (p: (typeof partners)[number], u: (typeof users)[number]) =>
    !u.isSuperAdmin && p.ownerId !== u.id && !p.members.some((m) => m.userId === u.id);
  const partner = partners.find((p) => users.some((u) => isOutsider(p, u))) ?? partners[0];
  if (!partner) throw new Error("확인할 파트너가 없습니다.");
  console.log(`파트너 "${partner.name}" 기준`);

  const member = users.find((u) => !u.isSuperAdmin && !isOutsider(partner, u));
  const outsider = users.find((u) => isOutsider(partner, u));
  if (member) {
    const a = await getNoticeAccess(partner.id, member.id, false);
    check(`참여자(${member.name}) 관리 가능`, a.canManage);
  }
  if (outsider) {
    const a = await getNoticeAccess(partner.id, outsider.id, false);
    check(`미참여자(${outsider.name}) 차단`, !a.canView && !a.canManage);
  }

  // --- 목록: 소속 파트너별로 갈리는지 ---
  const author = users[0];
  const other = partners.find((p) => p.id !== partner.id);
  const created = await prisma.$transaction([
    prisma.partnerLink.create({
      data: { partnerId: partner.id, title: "[점검] 이 파트너", url: "https://example.com/a", createdById: author.id },
    }),
    ...(other
      ? [prisma.partnerLink.create({
          data: { partnerId: other.id, title: "[점검] 다른 파트너", url: "https://example.com/b", createdById: author.id },
        })]
      : []),
  ]);
  try {
    const list = await listPartnerLinks(partner.id);
    check("만든 링크가 목록에 있다", list.some((l) => l.id === created[0].id));
    if (created[1]) {
      check("다른 파트너 링크는 섞이지 않는다", !list.some((l) => l.id === created[1].id));
    }
    check("만든 순서대로", list.length < 2 || list[0].id !== created[0].id || list.at(-1)!.id === created[0].id);
    const mine = list.find((l) => l.id === created[0].id)!;
    check("제목과 주소가 그대로", mine.title === "[점검] 이 파트너" && mine.url === "https://example.com/a");
  } finally {
    await prisma.partnerLink.deleteMany({ where: { id: { in: created.map((l) => l.id) } } });
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
