import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export function listVisibleProjects(
  userId: string,
  isSuperAdmin: boolean,
  includeHidden = false,
) {
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

  return prisma.project.findMany({
    where,
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
