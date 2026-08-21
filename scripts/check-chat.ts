// 채팅 동작 점검. 실행:
//   npm run check:chat
//
// 주의: DATABASE_URL이 가리키는 DB에 실제로 방과 메시지를 쓰고, 끝나면 지운다(finally 정리).
// 개발 DB와 운영 DB가 같으므로 운영 데이터에 테스트 흔적이 잠깐 생겼다 사라진다.
// 기존 데이터(파트너·사용자·이미 있는 대화)는 만들지도, 지우지도 않는다.
import { prisma } from "../lib/prisma";
import {
  listChatMessages,
  listChatRooms,
  countUnreadChat,
  getRoomAccess,
  requireRoomAccess,
  directKeyOf,
  CHAT_PAGE_SIZE,
} from "../lib/chat";
import {
  findActiveToken,
  replaceToken,
  splitChatMarkup,
  mentionedUserIds,
  buildMarker,
  toPlainText,
} from "../lib/chat-markup";

const createdMessageIds: string[] = [];
const createdRoomIds: string[] = [];
const createdReadKeys: { roomId: string; userId: string }[] = [];
let ok = 0;
let fail = 0;

function check(label: string, cond: boolean, extra = "") {
  if (cond) {
    ok++;
    console.log("  OK  ", label, extra);
  } else {
    fail++;
    console.log("  FAIL", label, extra);
  }
}

async function say(roomId: string, authorId: string, body: string, createdAt?: Date) {
  const m = await prisma.chatMessage.create({
    data: { roomId, authorId, body, ...(createdAt ? { createdAt } : {}) },
  });
  createdMessageIds.push(m.id);
  return m;
}

async function markRead(roomId: string, userId: string) {
  const lastReadAt = new Date();
  await prisma.chatRead.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: { lastReadAt },
    create: { roomId, userId, lastReadAt },
  });
  createdReadKeys.push({ roomId, userId });
}

async function main() {
  const partner = await prisma.partner.findFirstOrThrow({
    where: { deletedAt: null, members: { some: {} } },
    include: { members: true },
  });
  const memberIds = [...new Set([partner.ownerId, ...partner.members.map((m) => m.userId)])];
  const outsider = await prisma.user.findFirst({
    where: { id: { notIn: memberIds }, isSuperAdmin: false, isActive: true },
  });
  const [alice, bob] = memberIds;
  const partnerRoom = await prisma.chatRoom.findUniqueOrThrow({ where: { partnerId: partner.id } });
  console.log(`파트너: ${partner.name} / 멤버 ${memberIds.length}명 / 외부인 ${outsider ? "있음" : "없음"}`);

  console.log("\n[파트너방 권한]");
  check("멤버는 통과", (await getRoomAccess(partnerRoom.id, alice, false)).isMember);
  if (outsider) {
    check("비멤버는 차단", !(await getRoomAccess(partnerRoom.id, outsider.id, false)).isMember);
    check(
      "비멤버 목록에 이 방 없음",
      !(await listChatRooms(outsider.id, false)).some((r) => r.id === partnerRoom.id),
    );
  }
  check("총관리자는 통과", (await getRoomAccess(partnerRoom.id, outsider?.id ?? alice, true)).isMember);
  check("파트너방 참여자 수는 파트너 멤버십을 따른다", (await getRoomAccess(partnerRoom.id, alice, false)).memberIds.length === memberIds.length);

  console.log("\n[안읽음 집계]");
  const base = bob ?? alice;
  const before = (await countUnreadChat(base, false)).byRoom[partnerRoom.id] ?? 0;
  await say(partnerRoom.id, alice, "테스트 메시지 1");
  await say(partnerRoom.id, alice, "테스트 메시지 2");
  const afterOther = (await countUnreadChat(base, false)).byRoom[partnerRoom.id] ?? 0;
  if (bob) check("남이 쓴 글 2건이 안읽음으로 잡힘", afterOther === before + 2, `${before} -> ${afterOther}`);

  await say(partnerRoom.id, base, "내가 쓴 글");
  const afterMine = (await countUnreadChat(base, false)).byRoom[partnerRoom.id] ?? 0;
  check("내가 쓴 글은 안읽음에서 제외", afterMine === afterOther, `${afterOther} -> ${afterMine}`);

  console.log("\n[읽음 처리와 읽은 사람 표시]");
  await markRead(partnerRoom.id, base);
  const r1 = await prisma.chatRead.findUniqueOrThrow({
    where: { roomId_userId: { roomId: partnerRoom.id, userId: base } },
  });
  check("읽음 후 안읽음 0", ((await countUnreadChat(base, false)).byRoom[partnerRoom.id] ?? 0) === 0);

  await new Promise((r) => setTimeout(r, 1100));
  await markRead(partnerRoom.id, base);
  const r2 = await prisma.chatRead.findUniqueOrThrow({
    where: { roomId_userId: { roomId: partnerRoom.id, userId: base } },
  });
  check("다시 읽으면 lastReadAt이 전진함", r2.lastReadAt > r1.lastReadAt);

  const readCheck = await say(partnerRoom.id, alice, "읽음 표시 확인용");
  const beforeRead = (await listChatMessages(partnerRoom.id, alice, false)).messages.find(
    (m) => m.id === readCheck.id,
  );
  check("새 메시지는 아직 아무도 안 읽음", beforeRead?.readBy === 0, String(beforeRead?.readBy));
  if (bob) {
    await markRead(partnerRoom.id, bob);
    const afterRead = (await listChatMessages(partnerRoom.id, alice, false)).messages.find(
      (m) => m.id === readCheck.id,
    );
    check("상대가 읽으면 readBy가 오른다", (afterRead?.readBy ?? 0) >= 1, String(afterRead?.readBy));
  }

  console.log("\n[페이지네이션]");
  const now = Date.now();
  for (let i = 0; i < CHAT_PAGE_SIZE + 5; i++) {
    await say(partnerRoom.id, alice, `페이지 테스트 ${i}`, new Date(now - (CHAT_PAGE_SIZE + 5 - i) * 1000));
  }
  const p1 = await listChatMessages(partnerRoom.id, alice, false);
  check("한 번에 최대 50건", p1.messages.length === CHAT_PAGE_SIZE, `${p1.messages.length}건`);
  check("더 있음 표시", p1.hasMore);
  check("오래된 순 정렬", p1.messages[0].createdAt <= p1.messages[p1.messages.length - 1].createdAt);
  const p2 = await listChatMessages(partnerRoom.id, alice, false, p1.messages[0].createdAt);
  check("이전 묶음이 더 과거", p2.messages.every((m) => m.createdAt < p1.messages[0].createdAt));
  check("두 묶음이 겹치지 않음", !p2.messages.some((m) => p1.messages.some((x) => x.id === m.id)));

  console.log("\n[소프트 삭제]");
  const victim = await say(partnerRoom.id, alice, "곧 삭제될 비밀 내용");
  await prisma.chatMessage.update({ where: { id: victim.id }, data: { deletedAt: new Date() } });
  const afterDelete = await listChatMessages(partnerRoom.id, alice, false);
  const found = afterDelete.messages.find((m) => m.id === victim.id);
  check("삭제된 메시지도 목록에 남음", !!found);
  check("삭제 표시가 붙음", !!found?.deleted);
  check("본문이 페이로드에 안 실림", found?.body === "");

  console.log("\n[리액션]");
  const target = await say(partnerRoom.id, alice, "리액션 대상");
  await prisma.chatReaction.create({ data: { messageId: target.id, userId: alice, emoji: "👍" } });
  if (bob) await prisma.chatReaction.create({ data: { messageId: target.id, userId: bob, emoji: "👍" } });
  const withReaction = (await listChatMessages(partnerRoom.id, alice, false)).messages.find(
    (m) => m.id === target.id,
  );
  const thumb = withReaction?.reactions.find((r) => r.emoji === "👍");
  check("같은 이모지는 하나로 묶여 개수가 센다", thumb?.count === (bob ? 2 : 1), String(thumb?.count));
  check("내가 누른 것은 mine으로 표시", thumb?.mine === true);
  const otherView = (await listChatMessages(partnerRoom.id, bob ?? alice, false)).messages.find(
    (m) => m.id === target.id,
  );
  check(
    "다른 사람 화면에서는 mine이 자기 기준",
    otherView?.reactions.find((r) => r.emoji === "👍")?.mine === true,
  );

  console.log("\n[인용 답장]");
  const original = await say(partnerRoom.id, alice, "원본 메시지");
  const reply = await prisma.chatMessage.create({
    data: { roomId: partnerRoom.id, authorId: alice, body: "답장입니다", replyToId: original.id },
  });
  createdMessageIds.push(reply.id);
  const withReply = (await listChatMessages(partnerRoom.id, alice, false)).messages.find(
    (m) => m.id === reply.id,
  );
  check("답장이 원본을 가리킨다", withReply?.replyTo?.id === original.id);
  check("원본 작성자 이름이 함께 온다", !!withReply?.replyTo?.authorName);
  await prisma.chatMessage.update({ where: { id: original.id }, data: { deletedAt: new Date() } });
  const afterOriginalDelete = (await listChatMessages(partnerRoom.id, alice, false)).messages.find(
    (m) => m.id === reply.id,
  );
  check("원본이 지워져도 답장은 남는다", !!afterOriginalDelete);
  check("지워진 원본의 본문은 비워진다", afterOriginalDelete?.replyTo?.body === "");

  console.log("\n[1:1 방]");
  if (bob) {
    const key = directKeyOf(alice, bob);
    check("방 키는 순서와 무관하다", key === directKeyOf(bob, alice));
    const direct = await prisma.chatRoom.create({
      data: { kind: "DIRECT", directKey: key, members: { create: [{ userId: alice }, { userId: bob }] } },
    });
    createdRoomIds.push(direct.id);
    check("참여자 두 명만 들어간다", (await getRoomAccess(direct.id, alice, false)).memberIds.length === 2);
    if (outsider) {
      check("남의 1:1은 비참여자에게 닫힌다", !(await getRoomAccess(direct.id, outsider.id, false)).isMember);
      check("남의 1:1은 총관리자에게도 닫힌다", !(await getRoomAccess(direct.id, outsider.id, true)).isMember);
    }
    let duplicated = false;
    try {
      await prisma.chatRoom.create({ data: { kind: "DIRECT", directKey: key } });
      duplicated = true;
    } catch {
      duplicated = false;
    }
    check("같은 조합으로 방이 두 개 생기지 않는다", !duplicated);
  }

  console.log("\n[단체방]");
  const group = await prisma.chatRoom.create({
    data: { kind: "GROUP", name: "점검용 단체방", members: { create: [{ userId: alice }] } },
  });
  createdRoomIds.push(group.id);
  check("참여자는 들어간다", (await getRoomAccess(group.id, alice, false)).isMember);
  if (outsider) {
    check("비참여자는 막힌다", !(await getRoomAccess(group.id, outsider.id, false)).isMember);
    check("단체방은 총관리자가 관리할 수 있다", (await getRoomAccess(group.id, outsider.id, true)).isMember);
  }
  await requireRoomAccess(group.id, alice, false).then(
    () => check("requireRoomAccess가 참여자를 통과시킨다", true),
    () => check("requireRoomAccess가 참여자를 통과시킨다", false),
  );

  console.log("\n[멘션·태그 마크업]");
  const at = findActiveToken("안녕 @홍", 5);
  check("@ 뒤 글자를 검색어로 잡는다", at?.trigger === "@" && at.query === "홍");
  const slash = findActiveToken("보고서 /경주", 7);
  check("/ 도 트리거로 잡는다", slash?.trigger === "/" && slash.query === "경주");
  check("이메일 중간의 @는 트리거가 아니다", findActiveToken("a@b", 3) === null);
  check("주소 안의 /는 트리거가 아니다", findActiveToken("https://ex.com", 14) === null);
  check("날짜 8/21의 /는 트리거가 아니다", findActiveToken("마감 8/21", 8) === null);
  check("줄이 바뀌면 닫힌다", findActiveToken("@홍\ndd", 5) === null);

  const token = findActiveToken("안녕 @홍", 5)!;
  const replaced = replaceToken("안녕 @홍", token, 5, "@", "홍길동", "user1");
  check("고르면 마커로 바뀐다", replaced.text === "안녕 @[홍길동](user1) ");
  check("커서가 마커 뒤로 간다", replaced.caret === replaced.text.length);

  const body = "@[홍길동](user1) 이거 /[경주 문산리](part1:proj1) 확인 부탁 https://ex.com";
  const segs = splitChatMarkup(body);
  check("멘션 조각을 뽑는다", segs.some((x) => x.kind === "mention" && x.userId === "user1"));
  check(
    "태그가 파트너와 프로젝트를 함께 담는다",
    segs.some((x) => x.kind === "tag" && x.partnerId === "part1" && x.projectId === "proj1"),
  );
  check(
    "파트너 없는 옛 형식도 읽힌다",
    splitChatMarkup("/[제목](proj1)").some((x) => x.kind === "tag" && x.partnerId === null),
  );
  check("멘션 대상 id 목록", JSON.stringify(mentionedUserIds(body)) === JSON.stringify(["user1"]));
  check("중복 멘션은 한 번만", mentionedUserIds("@[A](u1) @[A](u1)").length === 1);
  check("라벨의 대괄호는 제거된다", buildMarker("@", "홍[길]동", "u1") === "@[홍길동](u1)");
  check("마커가 아닌 대괄호는 본문 그대로", splitChatMarkup("배열 [0] 확인").every((x) => x.kind === "text"));
  check("평문 변환은 마커를 읽기 좋게 푼다", toPlainText(body).startsWith("@홍길동 이거 /경주 문산리"));

  console.log(`\n결과: 통과 ${ok} / 실패 ${fail}`);
}

main()
  .catch((e) => {
    fail++;
    console.error("스크립트 오류:", e.message);
  })
  .finally(async () => {
    const msgs = await prisma.chatMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    const rooms = await prisma.chatRoom.deleteMany({ where: { id: { in: createdRoomIds } } });
    for (const k of createdReadKeys) {
      await prisma.chatRead.delete({ where: { roomId_userId: k } }).catch(() => {});
    }
    console.log(
      `정리: 메시지 ${msgs.count}건, 방 ${rooms.count}개, 읽음 ${createdReadKeys.length}건 삭제 / 남은 메시지 ${await prisma.chatMessage.count()}건`,
    );
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  });
