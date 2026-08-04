import { prisma } from "@/lib/prisma";

export async function getProjectAccess(projectId: string, userId: string, isSuperAdmin: boolean) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      members: { include: { user: true } },
    },
  });

  if (!project) {
    return { project: null, isOwner: false, isMember: false, canView: false };
  }

  const isOwner = project.ownerId === userId;
  const isMember = isOwner || project.members.some((m) => m.userId === userId);
  const hidden = project.isArchived || project.deletedAt !== null;

  const canView = hidden ? isSuperAdmin : project.visibility === "PUBLIC" || isMember || isSuperAdmin;

  return { project, isOwner, isMember, canView };
}
