import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";

// 공지는 두 종류를 한 테이블(Notice)에 담는다. 다른 건 "누가 보고 누가 고칠 수 있는가"뿐이다.
//
//  · 전체공지(partnerId = null): 대시보드에서 모든 사용자에게 똑같이 보인다. 로그인한
//    사람이면 누구나 쓰고 고치고 지울 수 있다 — 소수 인원이 함께 쓰는 도구라 등급을
//    나누는 것보다 아무나 바로 올릴 수 있는 편이 쓸모 있다.
//  · 파트너 공지(partnerId = 파트너): 그 파트너 탭에서만 보인다. 그 파트너에 참여 중이면
//    보는 것도 고치는 것도 다 되고, 미참여자는 존재 자체를 못 본다.
export async function getNoticeAccess(
  partnerId: string | null,
  userId: string,
  isSuperAdmin: boolean,
): Promise<{ canView: boolean; canManage: boolean }> {
  if (!partnerId) return { canView: true, canManage: true };

  const { isMember } = await getPartnerAccess(partnerId, userId, isSuperAdmin);
  return { canView: isMember, canManage: isMember };
}

const NOTICE_SELECT = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  updatedBy: { select: { name: true } },
} as const;

export type NoticeItem = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
  updatedByName: string | null;
};

// 최신순. 화면은 맨 앞 1개만 펼쳐 두고 나머지는 접어서 보여준다.
export async function listNotices(partnerId: string | null): Promise<NoticeItem[]> {
  const notices = await prisma.notice.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    select: NOTICE_SELECT,
  });

  return notices.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    createdByName: n.createdBy.name,
    updatedByName: n.updatedBy?.name ?? null,
  }));
}
