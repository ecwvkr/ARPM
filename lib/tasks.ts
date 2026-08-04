import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";

export async function getTaskAccess(taskId: string, userId: string, isSuperAdmin: boolean) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      master: true,
      participants: { include: { user: true } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      project: true,
    },
  });

  if (!task) {
    return {
      task: null,
      isMaster: false,
      isParticipant: false,
      canView: false,
      canManage: false,
      canParticipantAct: false,
      canComment: false,
      canJoin: false,
      canLeave: false,
    };
  }

  const { canView: canViewProject } = await getProjectAccess(task.projectId, userId, isSuperAdmin);

  const isMaster = task.masterId === userId;
  const isParticipant = task.participants.some((p) => p.userId === userId);

  const canView = isSuperAdmin
    ? true
    : task.visibility === "PUBLIC"
      ? canViewProject
      : isMaster || isParticipant;

  const canManage = isMaster;
  const canParticipantAct = isMaster || isParticipant;
  const canComment = canView;
  const locked = task.completedAt !== null;
  const canJoin = canView && !isMaster && !isParticipant && !locked;
  const canLeave = isParticipant && !isMaster && !locked;

  return { task, isMaster, isParticipant, canView, canManage, canParticipantAct, canComment, canJoin, canLeave };
}

export function listTasksForProject(projectId: string, userId: string, isSuperAdmin: boolean) {
  return prisma.task.findMany({
    where: {
      projectId,
      OR: isSuperAdmin
        ? undefined
        : [
            { visibility: "PUBLIC" },
            { masterId: userId },
            { participants: { some: { userId } } },
          ],
    },
    include: {
      master: true,
      participants: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function isOverdue(dueDate: Date | null, status: string) {
  return !!dueDate && dueDate < new Date() && status !== "DONE";
}
