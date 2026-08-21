import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";

export const CHAT_PAGE_SIZE = 50;
export const CHAT_BODY_MAX = 2000;

export type ChatMessageView = {
  id: string;
  partnerId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  author: { id: string; name: string };
  replyTo: { id: string; authorName: string; body: string } | null;
};

export type ChatPartner = { id: string; name: string; color: string | null };

// 채팅 자격은 "이 파트너 업무에 직접 참여 중인가"(isMember)로 판단한다. 공개 파트너를
// 볼 수 있는 것(canView)과 대화에 끼는 것은 다르다 — 프로젝트 참여 자격과 같은 기준이다.
export async function requireChatMember(partnerId: string, userId: string, isSuperAdmin: boolean) {
  const { partner, isMember } = await getPartnerAccess(partnerId, userId, isSuperAdmin);
  if (!partner || partner.deletedAt) throw new Error("파트너를 찾을 수 없습니다.");
  if (!isMember) throw new Error("이 파트너의 참여 멤버만 대화할 수 있습니다.");
  return partner;
}

// 내가 대화할 수 있는 파트너 목록. 총관리자는 다른 권한과 마찬가지로 전부 포함한다.
export async function listChatPartners(userId: string, isSuperAdmin: boolean): Promise<ChatPartner[]> {
  return prisma.partner.findMany({
    where: {
      deletedAt: null,
      ...(isSuperAdmin ? {} : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }),
    },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

function toView(m: {
  id: string;
  partnerId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  author: { id: string; name: string };
  replyTo: { id: string; body: string; deletedAt: Date | null; author: { name: string } } | null;
}): ChatMessageView {
  const deleted = m.deletedAt !== null;
  return {
    id: m.id,
    partnerId: m.partnerId,
    // 삭제된 메시지는 본문을 아예 내보내지 않는다 — 화면에서 감추는 것만으로는
    // 클라이언트 페이로드에 원문이 그대로 남는다.
    body: deleted ? "" : m.body,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    deleted,
    author: m.author,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: m.replyTo.author.name,
          body: m.replyTo.deletedAt ? "" : m.replyTo.body,
        }
      : null,
  };
}

const messageInclude = {
  author: { select: { id: true, name: true } },
  replyTo: { select: { id: true, body: true, deletedAt: true, author: { select: { name: true } } } },
} as const;

// 최신 CHAT_PAGE_SIZE건을 읽어 오래된 순으로 돌려준다(화면은 위가 과거).
// before가 있으면 그보다 과거의 묶음 — '이전 메시지 더 보기'용이다.
export async function listChatMessages(
  partnerId: string,
  userId: string,
  isSuperAdmin: boolean,
  before?: Date,
): Promise<{ messages: ChatMessageView[]; hasMore: boolean }> {
  await requireChatMember(partnerId, userId, isSuperAdmin);

  const rows = await prisma.chatMessage.findMany({
    where: { partnerId, ...(before ? { createdAt: { lt: before } } : {}) },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: CHAT_PAGE_SIZE + 1, // 한 건 더 읽어 '더 있음'을 판정한다
  });

  const hasMore = rows.length > CHAT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;
  return { messages: page.reverse().map(toView), hasMore };
}

// 파트너별 안읽음 수. 파트너마다 기준 시각이 달라 OR로 (파트너, 시각) 쌍을 나열하고
// 한 번에 집계한다 — 파트너 수만큼 쿼리를 돌리지 않기 위한 것.
export async function countUnreadChat(
  userId: string,
  isSuperAdmin: boolean,
): Promise<{ total: number; byPartner: Record<string, number> }> {
  const partners = await listChatPartners(userId, isSuperAdmin);
  if (partners.length === 0) return { total: 0, byPartner: {} };

  const reads = await prisma.chatRead.findMany({
    where: { userId, partnerId: { in: partners.map((p) => p.id) } },
    select: { partnerId: true, lastReadAt: true },
  });
  const readAt = new Map(reads.map((r) => [r.partnerId, r.lastReadAt]));

  const grouped = await prisma.chatMessage.groupBy({
    by: ["partnerId"],
    where: {
      deletedAt: null,
      authorId: { not: userId }, // 내가 쓴 글은 안읽음이 아니다
      OR: partners.map((p) => ({
        partnerId: p.id,
        createdAt: { gt: readAt.get(p.id) ?? new Date(0) },
      })),
    },
    _count: { _all: true },
  });

  const byPartner: Record<string, number> = {};
  let total = 0;
  for (const g of grouped) {
    byPartner[g.partnerId] = g._count._all;
    total += g._count._all;
  }
  return { total, byPartner };
}

export { toView as toChatMessageView, messageInclude as chatMessageInclude };
