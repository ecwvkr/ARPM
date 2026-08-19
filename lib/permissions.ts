import { prisma } from "@/lib/prisma";

export async function getPartnerAccess(partnerId: string, userId: string, isSuperAdmin: boolean) {
  const partner = await prisma.partner.findUnique({
    where: { id: partnerId },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });

  if (!partner) {
    return { partner: null, isOwner: false, isMember: false, canView: false };
  }

  // 총관리자는 공개/비공개·소유 여부와 무관하게 모든 파트너를 관리할 수 있다(절대 권한).
  // isOwner는 코드 전반에서 "이 파트너를 관리할 수 있는가"의 게이트로만 쓰이므로 여기에 함께 태운다.
  const isOwner = partner.ownerId === userId || isSuperAdmin;
  // isMember는 "이 파트너 업무에 직접 참여 중인가" — 프로젝트 생성·참여 자격의 기준이다.
  const isMember = isOwner || partner.members.some((m) => m.userId === userId);
  // 숨김(hide)은 이제 개인 설정이라 접근 권한과 무관하다. 보관함(deletedAt)만 접근을 막고,
  // 총관리자와 owner는 복구를 위해 보관된 상태에서도 볼 수 있어야 한다.
  const archived = partner.deletedAt !== null;

  const canView = archived
    ? isSuperAdmin || isOwner
    : partner.visibility === "PUBLIC" || isMember || isSuperAdmin;

  return { partner, isOwner, isMember, canView };
}
