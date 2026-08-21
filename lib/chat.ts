import { prisma } from "@/lib/prisma";

export const CHAT_PAGE_SIZE = 50;
export const CHAT_BODY_MAX = 2000;

export type ChatRoomKind = "PARTNER" | "DIRECT" | "GROUP";

export type ChatRoomSummary = {
  id: string;
  kind: ChatRoomKind;
  name: string;
  color: string | null; // 파트너방만 색을 가진다
  partnerId: string | null;
  memberCount: number;
  unread: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
};

export type ChatReactionView = { emoji: string; count: number; mine: boolean };

export type ChatMessageView = {
  id: string;
  roomId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  author: { id: string; name: string };
  replyTo: { id: string; authorName: string; body: string } | null;
  reactions: ChatReactionView[];
  readBy: number; // 작성자를 뺀, 이 메시지를 읽은 사람 수
};

// 1:1 방은 두 사람 조합당 하나만 있어야 하므로 id를 정렬해 키로 삼는다.
export function directKeyOf(a: string, b: string) {
  return [a, b].sort().join(":");
}

// 방 참여자 판정. 파트너방은 PartnerMember를 그대로 물려받고(멤버십을 두 곳에서
// 관리하지 않기 위해서다), 1:1·단체방은 ChatRoomMember로 직접 관리한다.
export async function getRoomAccess(roomId: string, userId: string, isSuperAdmin: boolean) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      partner: { include: { members: { select: { userId: true } } } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!room) return { room: null, isMember: false, memberIds: [] as string[] };

  if (room.kind === "PARTNER") {
    if (!room.partner || room.partner.deletedAt) return { room: null, isMember: false, memberIds: [] };
    const memberIds = [...new Set([room.partner.ownerId, ...room.partner.members.map((m) => m.userId)])];
    return { room, isMember: isSuperAdmin || memberIds.includes(userId), memberIds };
  }

  const memberIds = room.members.map((m) => m.userId);
  // 단체방은 총관리자가 관리자이므로 참여자가 아니어도 들어갈 수 있다.
  // 1:1은 남의 대화이므로 총관리자에게도 열지 않는다.
  const isMember = memberIds.includes(userId) || (room.kind === "GROUP" && isSuperAdmin);
  return { room, isMember, memberIds };
}

export async function requireRoomAccess(roomId: string, userId: string, isSuperAdmin: boolean) {
  const access = await getRoomAccess(roomId, userId, isSuperAdmin);
  if (!access.room) throw new Error("채팅방을 찾을 수 없습니다.");
  if (!access.isMember) throw new Error("이 채팅방에 참여하고 있지 않습니다.");
  return access;
}

// 파트너가 새로 생겨도 파트너방이 저절로 따라오게 한다 — 파트너 생성 코드에 훅을
// 거는 대신 목록을 읽을 때 빠진 것만 채운다.
async function ensurePartnerRooms(partnerIds: string[]) {
  if (partnerIds.length === 0) return;
  const existing = await prisma.chatRoom.findMany({
    where: { partnerId: { in: partnerIds } },
    select: { partnerId: true },
  });
  const have = new Set(existing.map((r) => r.partnerId));
  const missing = partnerIds.filter((id) => !have.has(id));
  if (missing.length === 0) return;
  await prisma.chatRoom.createMany({
    data: missing.map((partnerId) => ({ kind: "PARTNER" as const, partnerId })),
    skipDuplicates: true,
  });
}

export async function listChatRooms(userId: string, isSuperAdmin: boolean): Promise<ChatRoomSummary[]> {
  const partners = await prisma.partner.findMany({
    where: {
      deletedAt: null,
      ...(isSuperAdmin ? {} : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }),
    },
    select: { id: true, name: true, color: true, _count: { select: { members: true } } },
  });
  await ensurePartnerRooms(partners.map((p) => p.id));

  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const rooms = await prisma.chatRoom.findMany({
    where: {
      OR: [
        { kind: "PARTNER", partnerId: { in: partners.map((p) => p.id) } },
        { members: { some: { userId } } },
        // 총관리자는 단체방을 관리해야 하므로 참여하지 않은 방도 목록에 보인다.
        ...(isSuperAdmin ? [{ kind: "GROUP" as const }] : []),
      ],
    },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, body: true },
      },
    },
  });

  const reads = await prisma.chatRead.findMany({
    where: { userId, roomId: { in: rooms.map((r) => r.id) } },
    select: { roomId: true, lastReadAt: true },
  });
  const readAt = new Map(reads.map((r) => [r.roomId, r.lastReadAt]));

  const unreadGroups =
    rooms.length === 0
      ? []
      : await prisma.chatMessage.groupBy({
          by: ["roomId"],
          where: {
            deletedAt: null,
            authorId: { not: userId },
            OR: rooms.map((r) => ({
              roomId: r.id,
              createdAt: { gt: readAt.get(r.id) ?? new Date(0) },
            })),
          },
          _count: { _all: true },
        });
  const unreadByRoom = new Map(unreadGroups.map((g) => [g.roomId, g._count._all]));

  const summaries = rooms.map((room): ChatRoomSummary => {
    const partner = room.partnerId ? partnerById.get(room.partnerId) : undefined;
    const last = room.messages[0];
    return {
      id: room.id,
      kind: room.kind,
      name:
        room.kind === "PARTNER"
          ? (partner?.name ?? "이름 없는 파트너")
          : room.kind === "DIRECT"
            ? // 1:1 방 이름은 상대방 이름이다.
              (room.members.find((m) => m.userId !== userId)?.user.name ?? "알 수 없는 사용자")
            : (room.name ?? "단체 채팅"),
      color: room.kind === "PARTNER" ? (partner?.color ?? null) : null,
      partnerId: room.partnerId,
      memberCount:
        room.kind === "PARTNER" ? (partner ? partner._count.members + 1 : 0) : room.members.length,
      unread: unreadByRoom.get(room.id) ?? 0,
      lastMessageAt: last?.createdAt ?? null,
      lastMessagePreview: last?.body ?? null,
    };
  });

  // 안 읽은 방을 위로, 그다음 최근 대화순. 대화가 없는 방은 맨 아래.
  return summaries.sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    const at = a.lastMessageAt?.getTime() ?? 0;
    const bt = b.lastMessageAt?.getTime() ?? 0;
    if (at !== bt) return bt - at;
    return a.name.localeCompare(b.name, "ko");
  });
}

export async function countUnreadChat(
  userId: string,
  isSuperAdmin: boolean,
): Promise<{ total: number; byRoom: Record<string, number> }> {
  const rooms = await listChatRooms(userId, isSuperAdmin);
  const byRoom: Record<string, number> = {};
  let total = 0;
  for (const r of rooms) {
    if (r.unread > 0) {
      byRoom[r.id] = r.unread;
      total += r.unread;
    }
  }
  return { total, byRoom };
}

const messageInclude = {
  author: { select: { id: true, name: true } },
  replyTo: { select: { id: true, body: true, deletedAt: true, author: { select: { name: true } } } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

type RawMessage = {
  id: string;
  roomId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  authorId: string;
  author: { id: string; name: string };
  replyTo: { id: string; body: string; deletedAt: Date | null; author: { name: string } } | null;
  reactions: { emoji: string; userId: string }[];
};

function toView(m: RawMessage, viewerId: string, readTimes: Date[]): ChatMessageView {
  const deleted = m.deletedAt !== null;

  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions) {
    const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (r.userId === viewerId) entry.mine = true;
    byEmoji.set(r.emoji, entry);
  }

  return {
    id: m.id,
    roomId: m.roomId,
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
    reactions: [...byEmoji].map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine })),
    // 작성자 본인은 빼고 센다 — "몇 명이 봤는가"가 알고 싶은 값이다.
    readBy: readTimes.filter((t) => t >= m.createdAt).length,
  };
}

export async function listChatMessages(
  roomId: string,
  userId: string,
  isSuperAdmin: boolean,
  before?: Date,
): Promise<{ messages: ChatMessageView[]; hasMore: boolean; memberCount: number }> {
  const { memberIds } = await requireRoomAccess(roomId, userId, isSuperAdmin);

  const [rows, reads] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { roomId, ...(before ? { createdAt: { lt: before } } : {}) },
      include: messageInclude,
      orderBy: { createdAt: "desc" },
      take: CHAT_PAGE_SIZE + 1, // 한 건 더 읽어 '더 있음'을 판정한다
    }),
    prisma.chatRead.findMany({ where: { roomId }, select: { userId: true, lastReadAt: true } }),
  ]);

  const hasMore = rows.length > CHAT_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CHAT_PAGE_SIZE) : rows;

  return {
    messages: page.reverse().map((m) => {
      // 작성자 자신의 읽음 기록은 "읽은 사람"에서 뺀다.
      const others = reads.filter((r) => r.userId !== m.authorId).map((r) => r.lastReadAt);
      return toView(m, userId, others);
    }),
    hasMore,
    memberCount: memberIds.length,
  };
}

// '여기까지 읽음' 마커를 그릴 기준. 방에 들어가면서 읽음 처리하기 전의 값이어야
// 하므로 목록과 별도로 먼저 읽어 둔다.
export async function getLastReadAt(roomId: string, userId: string): Promise<Date | null> {
  const read = await prisma.chatRead.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { lastReadAt: true },
  });
  return read?.lastReadAt ?? null;
}

export type ComposerTargets = {
  members: { id: string; name: string }[];
  tags: { projectId: string; partnerId: string; label: string; kind: "project" | "task" }[];
};

// 자동완성 후보. 방을 열 때 한 번만 읽고 이후 타이핑은 클라이언트에서 거른다 —
// 글자마다 서버를 부르면 호출 수가 그대로 타이핑 수가 된다.
export async function listComposerTargets(
  roomId: string,
  userId: string,
  isSuperAdmin: boolean,
): Promise<ComposerTargets> {
  const { room, memberIds } = await requireRoomAccess(roomId, userId, isSuperAdmin);

  const members = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // 파트너방이면 그 파트너의 프로젝트만, 1:1·단체방이면 내가 볼 수 있는 파트너 전체.
  const partnerFilter = room!.partnerId
    ? { partnerId: room!.partnerId }
    : {
        partner: {
          deletedAt: null,
          ...(isSuperAdmin ? {} : { OR: [{ ownerId: userId }, { members: { some: { userId } } }] }),
        },
      };

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, ...partnerFilter },
    select: { id: true, title: true, partnerId: true, tasks: { select: { title: true, done: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const tags: ComposerTargets["tags"] = [];
  for (const p of projects) {
    tags.push({ projectId: p.id, partnerId: p.partnerId, label: p.title, kind: "project" });
    // 태스크도 프로젝트 링크로 이어진다 — 칩 하나에 대상 하나라는 규칙을 유지한다.
    for (const t of p.tasks) {
      if (!t.done) tags.push({ projectId: p.id, partnerId: p.partnerId, label: t.title, kind: "task" });
    }
  }

  return { members, tags };
}

export { toView as toChatMessageView, messageInclude as chatMessageInclude };
