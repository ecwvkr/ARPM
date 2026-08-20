import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// includeDeleted: 보관함(휴지통)에 있는 파트너까지 포함할지. 메인 화면들은 항상 false —
// 보관된 파트너는 설정 > 보관함 화면에서만 다룬다(D3).
// includeDiscoverable: 비공개+노출 파트너(카드만 보이고 내부는 못 보는 상태)까지 포함할지.
// 기본값 false가 안전한 쪽이다 — 프로젝트 목록 조회가 이 함수를 통해 파트너를 고르므로,
// 켜면 아직 참여하지 않은 비공개 파트너의 프로젝트까지 흘러나간다. 대시보드 카드 목록처럼
// "존재만 보여주는" 화면에서만 true로 켠다.
function visiblePartnersWhere(
  userId: string,
  isSuperAdmin: boolean,
  includeDeleted: boolean,
  includeDiscoverable = false,
): Prisma.PartnerWhereInput {
  const where: Prisma.PartnerWhereInput = {};

  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (!isSuperAdmin) {
    where.OR = [
      { visibility: "PUBLIC" },
      { ownerId: userId },
      { members: { some: { userId } } },
      ...(includeDiscoverable
        ? [{ visibility: "PRIVATE" as const, discoverable: true }]
        : []),
    ];
  }

  return where;
}

// 프로젝트 메타 정보만 필요한 대부분의 화면(전체 프로젝트 필터, 워크플로우 파트너 선택 등)이 쓰는
// 가벼운 조회. 프로젝트는 상태만 select해 카운트 용도로만 쓴다. 개인별 숨김은 대시보드 전용
// 개념이라 여기서는 적용하지 않는다 — 숨겨도 다른 화면의 필터 목록에는 여전히 나와야 한다.
export function listVisiblePartners(
  userId: string,
  isSuperAdmin: boolean,
  includeDeleted = false,
) {
  return prisma.partner.findMany({
    where: visiblePartnersWhere(userId, isSuperAdmin, includeDeleted),
    include: {
      owner: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      projects: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type PartnerSort = "activity" | "name" | "created";

const PARTNER_SORT_ORDER: Record<PartnerSort, Prisma.PartnerOrderByWithRelationInput> = {
  activity: { lastActivityAt: "desc" },
  name: { name: "asc" },
  created: { createdAt: "desc" },
};

// 대시보드 전용: 파트너 카드의 "미확인" 빨간 점 판정에 필요한 필드까지 함께 가져오고,
// 이 사용자가 개인적으로 숨기거나 즐겨찾기한 파트너도 함께 표시해(hiddenBy/pinnedBy)
// 대시보드에서 숨김 섹션 분리·즐겨찾기 상단 고정을 계산할 수 있게 한다(D2).
export function listVisiblePartnersWithUnread(
  userId: string,
  isSuperAdmin: boolean,
  sort: PartnerSort = "activity",
) {
  return prisma.partner.findMany({
    // 대시보드는 비공개+노출 파트너의 카드도 보여준다(참여 신청 경로).
    where: visiblePartnersWhere(userId, isSuperAdmin, false, true),
    include: {
      owner: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      hiddenBy: { where: { userId }, select: { userId: true } },
      pinnedBy: { where: { userId }, select: { userId: true } },
      // 참여 여부/신청 상태에 따라 카드를 나눠 보여주기 위해 내 것만 함께 읽는다.
      joinRequests: { where: { userId, status: "PENDING" }, select: { userId: true } },
      projects: {
        select: {
          status: true,
          masterId: true,
          updatedAt: true,
          participants: { select: { userId: true } },
          comments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
          reads: { where: { userId }, select: { lastReadAt: true } },
        },
      },
    },
    orderBy: PARTNER_SORT_ORDER[sort],
  });
}

// 설정 > 보관함(휴지통)에서 쓰는 목록. superAdmin은 전체, 그 외는 본인이 owner인 파트너만.
export function listTrashedPartners(userId: string, isSuperAdmin: boolean) {
  return prisma.partner.findMany({
    where: {
      deletedAt: { not: null },
      ...(isSuperAdmin ? {} : { ownerId: userId }),
    },
    select: { id: true, name: true, color: true, deletedAt: true, owner: { select: { name: true } } },
    orderBy: { deletedAt: "desc" },
  });
}
