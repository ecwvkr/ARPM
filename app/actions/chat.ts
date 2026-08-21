"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";
import {
  CHAT_BODY_MAX,
  chatMessageInclude,
  countUnreadChat,
  listChatMessages,
  listChatPartners,
  requireChatMember,
  toChatMessageView,
  type ChatMessageView,
  type ChatPartner,
} from "@/lib/chat";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { userId: session.user.id, isSuperAdmin: !!session.user.isSuperAdmin };
}

export async function fetchChatPartners(): Promise<ChatPartner[]> {
  const { userId, isSuperAdmin } = await requireSession();
  return listChatPartners(userId, isSuperAdmin);
}

// beforeIso가 있으면 그보다 과거 묶음을 읽는다('이전 메시지 더 보기').
export async function fetchChatMessages(
  partnerId: string,
  beforeIso?: string,
): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
  const { userId, isSuperAdmin } = await requireSession();
  return listChatMessages(partnerId, userId, isSuperAdmin, beforeIso ? new Date(beforeIso) : undefined);
}

export async function fetchUnreadChatCount() {
  const { userId, isSuperAdmin } = await requireSession();
  return countUnreadChat(userId, isSuperAdmin);
}

export async function sendChatMessage(
  partnerId: string,
  body: string,
  replyToId?: string,
): Promise<ChatMessageView> {
  const { userId, isSuperAdmin } = await requireSession();
  await requireChatMember(partnerId, userId, isSuperAdmin);

  const text = body.trim();
  if (!text) throw new Error("내용을 입력하세요.");
  if (text.length > CHAT_BODY_MAX) throw new Error(`메시지는 ${CHAT_BODY_MAX}자까지 보낼 수 있습니다.`);

  // 답장 대상이 같은 파트너 것인지 확인하지 않으면 다른 파트너 메시지를 인용해
  // 본문 일부를 끌어올 수 있다.
  if (replyToId) {
    const target = await prisma.chatMessage.findUnique({
      where: { id: replyToId },
      select: { partnerId: true },
    });
    if (target?.partnerId !== partnerId) throw new Error("답장할 메시지를 찾을 수 없습니다.");
  }

  const created = await prisma.chatMessage.create({
    data: { partnerId, authorId: userId, body: text, replyToId: replyToId ?? null },
    include: chatMessageInclude,
  });

  // 보낸 사람은 방금 자기 글까지 읽은 상태다(권한은 위에서 이미 확인했으므로 직접 upsert).
  await upsertRead(partnerId, userId);
  return toChatMessageView(created);
}

export async function markChatRead(partnerId: string) {
  const { userId, isSuperAdmin } = await requireSession();
  await requireChatMember(partnerId, userId, isSuperAdmin);
  await upsertRead(partnerId, userId);
}

// 읽음 시각은 반드시 값을 직접 넣어야 한다. update를 비워두면 Prisma가 UPDATE를
// 건너뛰어 lastReadAt이 처음 읽은 시각에 그대로 멈춘다(안읽음 뱃지가 영영 안 사라진다).
function upsertRead(partnerId: string, userId: string) {
  const lastReadAt = new Date();
  return prisma.chatRead.upsert({
    where: { partnerId_userId: { partnerId, userId } },
    update: { lastReadAt },
    create: { partnerId, userId, lastReadAt },
  });
}

export async function editChatMessage(messageId: string, body: string): Promise<ChatMessageView> {
  const { userId } = await requireSession();

  const text = body.trim();
  if (!text) throw new Error("내용을 입력하세요.");
  if (text.length > CHAT_BODY_MAX) throw new Error(`메시지는 ${CHAT_BODY_MAX}자까지 보낼 수 있습니다.`);

  // 수정·삭제는 총관리자에게도 열지 않는다 — 남의 발언을 대신 고치는 것은 권한이 아니라
  // 기록의 신뢰 문제다. 삭제만 파트너 owner에게 열어둔다(아래).
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new Error("메시지를 찾을 수 없습니다.");
  if (message.authorId !== userId) throw new Error("본인이 쓴 메시지만 수정할 수 있습니다.");

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { body: text, editedAt: new Date() },
    include: chatMessageInclude,
  });
  return toChatMessageView(updated);
}

export async function deleteChatMessage(messageId: string) {
  const { userId, isSuperAdmin } = await requireSession();

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) return;

  // 작성자 본인, 또는 그 파트너를 관리하는 사람(owner·총관리자)이 지울 수 있다.
  const { isOwner } = await getPartnerAccess(message.partnerId, userId, isSuperAdmin);
  if (message.authorId !== userId && !isOwner) {
    throw new Error("본인이 쓴 메시지 또는 파트너 관리자만 삭제할 수 있습니다.");
  }

  // 인용 답장이 가리키는 원본이 사라지지 않도록 소프트 삭제한다.
  await prisma.chatMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
}
