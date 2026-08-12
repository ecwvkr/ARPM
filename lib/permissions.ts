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

  const isOwner = partner.ownerId === userId;
  const isMember = isOwner || partner.members.some((m) => m.userId === userId);
  // 숨김(hide)은 이제 개인 설정이라 접근 권한과 무관하다. 보관함(deletedAt)만 접근을 막고,
  // 총관리자와 owner는 복구를 위해 보관된 상태에서도 볼 수 있어야 한다.
  const archived = partner.deletedAt !== null;

  const canView = archived
    ? isSuperAdmin || isOwner
    : partner.visibility === "PUBLIC" || isMember || isSuperAdmin;

  return { partner, isOwner, isMember, canView };
}
