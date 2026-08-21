"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CHAT_BODY_MAX,
  chatMessageInclude,
  countUnreadChat,
  directKeyOf,
  getLastReadAt,
  getRoomAccess,
  listChatMessages,
  listChatRooms,
  listComposerTargets,
  requireRoomAccess,
  toChatMessageView,
  type ChatMessageView,
  type ChatRoomSummary,
  type ComposerTargets,
} from "@/lib/chat";
import { mentionedUserIds, toPlainText } from "@/lib/chat-markup";
import { sendChatPush } from "@/lib/push";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return {
    userId: session.user.id,
    isSuperAdmin: !!session.user.isSuperAdmin,
    userName: session.user.name ?? "누군가",
  };
}

async function requireSuperAdmin() {
  const session = await requireSession();
  if (!session.isSuperAdmin) throw new Error("총관리자만 할 수 있습니다.");
  return session;
}

export async function fetchChatRooms(): Promise<ChatRoomSummary[]> {
  const { userId, isSuperAdmin } = await requireSession();
  return listChatRooms(userId, isSuperAdmin);
}

export async function fetchChatComposerTargets(roomId: string): Promise<ComposerTargets> {
  const { userId, isSuperAdmin } = await requireSession();
  return listComposerTargets(roomId, userId, isSuperAdmin);
}

// beforeIso가 있으면 그보다 과거 묶음을 읽는다('이전 메시지 더 보기').
export async function fetchChatMessages(roomId: string, beforeIso?: string) {
  const { userId, isSuperAdmin } = await requireSession();
  return listChatMessages(roomId, userId, isSuperAdmin, beforeIso ? new Date(beforeIso) : undefined);
}

// 방에 들어갈 때 한 번: 목록과 '여기까지 읽음' 기준을 함께 준다.
// 읽음 처리는 여기서 하지 않는다 — 같은 호출 안에서 갱신하면 그 값을 다시 읽었을 때
// 기준이 방금 읽은 시각으로 덮여 마커가 사라진다. 화면에 반영한 뒤 클라이언트가
// markChatRead를 따로 부른다.
export async function openChatRoom(roomId: string) {
  const { userId, isSuperAdmin } = await requireSession();
  const lastReadAt = await getLastReadAt(roomId, userId);
  const page = await listChatMessages(roomId, userId, isSuperAdmin, undefined);
  return { ...page, lastReadAt };
}

export async function fetchUnreadChatCount() {
  const { userId, isSuperAdmin } = await requireSession();
  return countUnreadChat(userId, isSuperAdmin);
}

export async function sendChatMessage(
  roomId: string,
  body: string,
  replyToId?: string,
): Promise<ChatMessageView> {
  const { userId, isSuperAdmin, userName } = await requireSession();
  const { room, memberIds } = await requireRoomAccess(roomId, userId, isSuperAdmin);

  const text = body.trim();
  if (!text) throw new Error("내용을 입력하세요.");
  if (text.length > CHAT_BODY_MAX) throw new Error(`메시지는 ${CHAT_BODY_MAX}자까지 보낼 수 있습니다.`);

  // 답장 대상이 같은 방 것인지 확인하지 않으면 다른 방 메시지를 인용해 본문 일부를
  // 끌어올 수 있다.
  if (replyToId) {
    const target = await prisma.chatMessage.findUnique({
      where: { id: replyToId },
      select: { roomId: true },
    });
    if (target?.roomId !== roomId) throw new Error("답장할 메시지를 찾을 수 없습니다.");
  }

  const created = await prisma.chatMessage.create({
    data: { roomId, authorId: userId, body: text, replyToId: replyToId ?? null },
    include: chatMessageInclude,
  });

  // 보낸 사람은 방금 자기 글까지 읽은 상태다.
  await upsertRead(roomId, userId);

  const roomLabel =
    room!.kind === "PARTNER" ? (room!.partner?.name ?? "파트너") : (room!.name ?? "대화");
  const preview = toPlainText(text).slice(0, 60);

  // 멘션 알림은 기존 Notification에 얹는다 — 알림 종류가 두 벌이 되면 벨과 뱃지가
  // 서로 다른 값을 보여준다. 본인 멘션과 이 방 참여자가 아닌 대상은 걸러낸다.
  const mentionTargets = mentionedUserIds(text).filter((id) => id !== userId && memberIds.includes(id));
  if (mentionTargets.length > 0) {
    await prisma.notification.createMany({
      data: mentionTargets.map((id) => ({
        userId: id,
        type: "CHAT_MENTION",
        refId: room!.partnerId,
        message: `${userName}님이 ${roomLabel} 대화에서 회원님을 언급했습니다: "${preview}"`,
      })),
    });
  }

  // 푸시는 응답을 늦출 이유가 없으므로 응답을 보낸 뒤에 처리한다.
  const pushTargets = memberIds.filter((id) => id !== userId);
  if (pushTargets.length > 0) {
    after(() => sendChatPush(pushTargets, `${userName} · ${roomLabel}`, preview));
  }

  return toChatMessageView(created, userId, []);
}

export async function markChatRead(roomId: string) {
  const { userId, isSuperAdmin } = await requireSession();
  await requireRoomAccess(roomId, userId, isSuperAdmin);
  await upsertRead(roomId, userId);
}

// 읽음 시각은 반드시 값을 직접 넣어야 한다. update를 비워두면 Prisma가 UPDATE를
// 건너뛰어 lastReadAt이 처음 읽은 시각에 그대로 멈춘다.
function upsertRead(roomId: string, userId: string) {
  const lastReadAt = new Date();
  return prisma.chatRead.upsert({
    where: { roomId_userId: { roomId, userId } },
    update: { lastReadAt },
    create: { roomId, userId, lastReadAt },
  });
}

export async function editChatMessage(messageId: string, body: string): Promise<ChatMessageView> {
  const { userId } = await requireSession();

  const text = body.trim();
  if (!text) throw new Error("내용을 입력하세요.");
  if (text.length > CHAT_BODY_MAX) throw new Error(`메시지는 ${CHAT_BODY_MAX}자까지 보낼 수 있습니다.`);

  // 수정은 총관리자에게도 열지 않는다 — 남의 발언을 대신 고치는 것은 권한이 아니라
  // 기록의 신뢰 문제다.
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new Error("메시지를 찾을 수 없습니다.");
  if (message.authorId !== userId) throw new Error("본인이 쓴 메시지만 수정할 수 있습니다.");

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { body: text, editedAt: new Date() },
    include: chatMessageInclude,
  });
  return toChatMessageView(updated, userId, []);
}

export async function deleteChatMessage(messageId: string) {
  const { userId, isSuperAdmin } = await requireSession();

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) return;

  const { room } = await getRoomAccess(message.roomId, userId, isSuperAdmin);
  // 작성자 본인, 또는 그 방을 관리하는 사람이 지울 수 있다.
  const canModerate =
    room?.kind === "PARTNER" ? room.partner?.ownerId === userId || isSuperAdmin : isSuperAdmin;
  if (message.authorId !== userId && !canModerate) {
    throw new Error("본인이 쓴 메시지 또는 관리자만 삭제할 수 있습니다.");
  }

  // 인용 답장이 가리키는 원본이 사라지지 않도록 소프트 삭제한다.
  await prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
}

export async function toggleChatReaction(messageId: string, emoji: string) {
  const { userId, isSuperAdmin } = await requireSession();

  // 이모지는 본문이 아니라 짧은 라벨이므로 길이만 막아도 충분하다.
  const value = emoji.trim();
  if (!value || value.length > 8) throw new Error("사용할 수 없는 이모지입니다.");

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { roomId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw new Error("메시지를 찾을 수 없습니다.");
  await requireRoomAccess(message.roomId, userId, isSuperAdmin);

  const key = { messageId_userId_emoji: { messageId, userId, emoji: value } };
  const existing = await prisma.chatReaction.findUnique({ where: key });
  if (existing) await prisma.chatReaction.delete({ where: key });
  else await prisma.chatReaction.create({ data: { messageId, userId, emoji: value } });
}

// ── 방 만들기 ────────────────────────────────────────────────────────────────

// 1:1 방은 누구나 열 수 있다 — 상대가 정해져 있어 방이 무한정 늘지 않는다.
// 이미 있으면 그 방을 그대로 돌려준다.
export async function openDirectRoom(otherUserId: string): Promise<string> {
  const { userId } = await requireSession();
  if (otherUserId === userId) throw new Error("자기 자신과는 대화할 수 없습니다.");

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true, isActive: true },
  });
  if (!other || !other.isActive) throw new Error("대화할 수 없는 사용자입니다.");

  const directKey = directKeyOf(userId, otherUserId);
  const existing = await prisma.chatRoom.findUnique({ where: { directKey }, select: { id: true } });
  if (existing) return existing.id;

  const room = await prisma.chatRoom.create({
    data: {
      kind: "DIRECT",
      directKey,
      createdById: userId,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
  });
  return room.id;
}

// 단체방 생성·초대·강퇴는 총관리자만 — 방이 무분별하게 늘어나는 것을 막는 제한이다.
export async function createGroupRoom(name: string, memberIds: string[]): Promise<string> {
  const { userId } = await requireSuperAdmin();

  const title = name.trim();
  if (!title) throw new Error("채팅방 이름을 입력하세요.");
  if (title.length > 40) throw new Error("채팅방 이름은 40자까지 가능합니다.");

  const targets = [...new Set([userId, ...memberIds])];
  const valid = await prisma.user.findMany({
    where: { id: { in: targets }, isActive: true },
    select: { id: true },
  });

  const room = await prisma.chatRoom.create({
    data: {
      kind: "GROUP",
      name: title,
      createdById: userId,
      members: { create: valid.map((u) => ({ userId: u.id })) },
    },
  });
  return room.id;
}

export async function inviteToGroupRoom(roomId: string, memberIds: string[]) {
  await requireSuperAdmin();
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, select: { kind: true } });
  if (room?.kind !== "GROUP") throw new Error("단체 채팅방만 초대할 수 있습니다.");

  const valid = await prisma.user.findMany({
    where: { id: { in: memberIds }, isActive: true },
    select: { id: true },
  });
  await prisma.chatRoomMember.createMany({
    data: valid.map((u) => ({ roomId, userId: u.id })),
    skipDuplicates: true,
  });
}

export async function removeFromGroupRoom(roomId: string, memberId: string) {
  await requireSuperAdmin();
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, select: { kind: true } });
  if (room?.kind !== "GROUP") throw new Error("단체 채팅방만 내보낼 수 있습니다.");

  await prisma.chatRoomMember.deleteMany({ where: { roomId, userId: memberId } });
}

export async function fetchRoomMembers(roomId: string) {
  const { userId, isSuperAdmin } = await requireSession();
  const { room, memberIds } = await requireRoomAccess(roomId, userId, isSuperAdmin);
  const users = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return { kind: room!.kind, name: room!.name, members: users };
}
