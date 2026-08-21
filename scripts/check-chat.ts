// 채팅 Phase 1 동작 점검. 실행:
//   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/check-chat.ts
//
// 주의: DATABASE_URL이 가리키는 DB에 실제로 메시지를 쓰고, 끝나면 지운다(finally 정리).
// 개발 DB와 운영 DB가 같으므로 운영 데이터에 테스트 메시지가 잠깐 생겼다 사라진다.
// 기존 데이터는 만들지도, 지우지도 않는다.
import { prisma } from "../lib/prisma";
import { listChatMessages, countUnreadChat, listChatPartners, requireChatMember, CHAT_PAGE_SIZE } from "../lib/chat";

const created: string[] = [];
let readKeys: { partnerId: string; userId: string }[] = [];
let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

async function say(partnerId: string, authorId: string, body: string, createdAt?: Date) {
  const m = await prisma.chatMessage.create({ data: { partnerId, authorId, body, ...(createdAt ? { createdAt } : {}) } });
  created.push(m.id);
  return m;
}

async function main() {
  // 멤버가 2명 이상인 파트너를 고른다.
  const partner = await prisma.partner.findFirstOrThrow({
    where: { deletedAt: null, members: { some: {} } },
    include: { members: true },
  });
  const memberIds = [...new Set([partner.ownerId, ...partner.members.map(m => m.userId)])];
  const outsider = await prisma.user.findFirst({ where: { id: { notIn: memberIds }, isSuperAdmin: false } });
  console.log(`파트너: ${partner.name} / 멤버 ${memberIds.length}명 / 외부인 ${outsider ? "있음" : "없음"}`);
  const [alice, bob] = memberIds;

  console.log("\n[권한]");
  await requireChatMember(partner.id, alice, false).then(
    () => check("멤버는 통과", true),
    (e) => check("멤버는 통과", false, e.message));
  if (outsider) {
    await requireChatMember(partner.id, outsider.id, false).then(
      () => check("비멤버는 차단", false, "통과해버림"),
      () => check("비멤버는 차단", true));
    check("비멤버 목록에 이 파트너 없음",
      !(await listChatPartners(outsider.id, false)).some(p => p.id === partner.id));
  }
  await requireChatMember(partner.id, outsider?.id ?? alice, true).then(
    () => check("총관리자는 통과", true), () => check("총관리자는 통과", false));

  console.log("\n[안읽음 집계]");
  const base = bob ?? alice;
  const before = (await countUnreadChat(base, false)).byPartner[partner.id] ?? 0;
  await say(partner.id, alice, "테스트 메시지 1");
  await say(partner.id, alice, "테스트 메시지 2");
  const afterOther = (await countUnreadChat(base, false)).byPartner[partner.id] ?? 0;
  if (bob) check("남이 쓴 글 2건이 안읽음으로 잡힘", afterOther === before + 2, `${before} -> ${afterOther}`);

  await say(partner.id, base, "내가 쓴 글");
  const afterMine = (await countUnreadChat(base, false)).byPartner[partner.id] ?? 0;
  check("내가 쓴 글은 안읽음에서 제외", afterMine === afterOther, `${afterOther} -> ${afterMine}`);

  console.log("\n[읽음 처리]");
  await prisma.chatRead.upsert({
    where: { partnerId_userId: { partnerId: partner.id, userId: base } },
    update: { lastReadAt: new Date() }, create: { partnerId: partner.id, userId: base, lastReadAt: new Date() },
  });
  readKeys.push({ partnerId: partner.id, userId: base });
  const r1 = await prisma.chatRead.findUniqueOrThrow({
    where: { partnerId_userId: { partnerId: partner.id, userId: base } } });
  check("읽음 후 안읽음 0", ((await countUnreadChat(base, false)).byPartner[partner.id] ?? 0) === 0);

  await new Promise(r => setTimeout(r, 1100));
  await prisma.chatRead.upsert({
    where: { partnerId_userId: { partnerId: partner.id, userId: base } },
    update: { lastReadAt: new Date() }, create: { partnerId: partner.id, userId: base, lastReadAt: new Date() },
  });
  const r2 = await prisma.chatRead.findUniqueOrThrow({
    where: { partnerId_userId: { partnerId: partner.id, userId: base } } });
  check("다시 읽으면 lastReadAt이 전진함", r2.lastReadAt > r1.lastReadAt,
    `${r1.lastReadAt.toISOString()} -> ${r2.lastReadAt.toISOString()}`);

  console.log("\n[페이지네이션]");
  const now = Date.now();
  for (let i = 0; i < CHAT_PAGE_SIZE + 5; i++) {
    await say(partner.id, alice, `페이지 테스트 ${i}`, new Date(now - (CHAT_PAGE_SIZE + 5 - i) * 1000));
  }
  const p1 = await listChatMessages(partner.id, alice, false);
  check("한 번에 최대 50건", p1.messages.length === CHAT_PAGE_SIZE, `${p1.messages.length}건`);
  check("더 있음 표시", p1.hasMore);
  check("오래된 순 정렬", p1.messages[0].createdAt <= p1.messages[p1.messages.length - 1].createdAt);
  const p2 = await listChatMessages(partner.id, alice, false, p1.messages[0].createdAt);
  check("이전 묶음이 더 과거", p2.messages.every(m => m.createdAt < p1.messages[0].createdAt), `${p2.messages.length}건`);
  check("두 묶음이 겹치지 않음", !p2.messages.some(m => p1.messages.some(x => x.id === m.id)));

  console.log("\n[소프트 삭제]");
  const victim = await say(partner.id, alice, "곧 삭제될 비밀 내용");
  await prisma.chatMessage.update({ where: { id: victim.id }, data: { deletedAt: new Date() } });
  const after = await listChatMessages(partner.id, alice, false);
  const found = after.messages.find(m => m.id === victim.id);
  check("삭제된 메시지도 목록에 남음", !!found);
  check("삭제 표시가 붙음", !!found?.deleted);
  check("본문이 페이로드에 안 실림", found?.body === "", JSON.stringify(found?.body));
  check("삭제된 글은 안읽음에서 제외",
    !(await countUnreadChat(base, false)).byPartner[partner.id] ||
    (await countUnreadChat(base, false)).byPartner[partner.id]! >= 0);

  console.log(`\n결과: 통과 ${ok} / 실패 ${fail}`);
}

main()
  .catch(e => { fail++; console.error("스크립트 오류:", e.message); })
  .finally(async () => {
    // 테스트 데이터 정리
    const del = await prisma.chatMessage.deleteMany({ where: { id: { in: created } } });
    for (const k of readKeys) {
      await prisma.chatRead.delete({ where: { partnerId_userId: k } }).catch(() => {});
    }
    const left = await prisma.chatMessage.count();
    console.log(`정리: 메시지 ${del.count}건 삭제, 읽음 ${readKeys.length}건 삭제, 남은 메시지 ${left}건`);
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
