import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function visibleProjectsWhere(
  userId: string,
  isSuperAdmin: boolean,
  includeHidden: boolean,
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};

  if (!isSuperAdmin || !includeHidden) {
    where.isArchived = false;
    where.deletedAt = null;
  }

  if (!isSuperAdmin) {
    where.OR = [
      { visibility: "PUBLIC" },
      { ownerId: userId },
      { members: { some: { userId } } },
    ];
  }

  return where;
}

// 프로젝트 메타 정보만 필요한 대부분의 화면(전체 업무 필터, 캔버스 프로젝트 선택 등)이 쓰는
// 가벼운 조회. 업무는 상태만 select해 카운트 용도로만 쓴다.
export function listVisibleProjects(
  userId: string,
  isSuperAdmin: boolean,
  includeHidden = false,
) {
  return prisma.project.findMany({
    where: visibleProjectsWhere(userId, isSuperAdmin, includeHidden),
    include: {
      owner: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      tasks: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// 대시보드 전용: 프로젝트 카드의 "미확인" 빨간 점 판정에 필요한 필드까지 함께 가져온다.
// 다른 화면은 이 무거운 조인이 필요 없으므로 위 listVisibleProjects를 대신 쓴다.
export function listVisibleProjectsWithUnread(
  userId: string,
  isSuperAdmin: boolean,
  includeHidden = false,
) {
  return prisma.project.findMany({
    where: visibleProjectsWhere(userId, isSuperAdmin, includeHidden),
    include: {
      owner: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      tasks: {
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
    orderBy: { createdAt: "desc" },
  });
}
