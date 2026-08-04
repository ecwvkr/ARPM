import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";

async function hasInheritedAccess(startParentId: string | null, userId: string): Promise<boolean> {
  let currentId = startParentId;
  while (currentId) {
    const ancestor = await prisma.task.findUnique({
      where: { id: currentId },
      select: {
        parentId: true,
        participants: { where: { userId, includeSubtree: true }, select: { userId: true } },
      },
    });
    if (!ancestor) return false;
    if (ancestor.participants.length > 0) return true;
    currentId = ancestor.parentId;
  }
  return false;
}

export async function getTaskAccess(taskId: string, userId: string, isSuperAdmin: boolean) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      master: true,
      parent: { select: { id: true, title: true } },
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
  const inheritedAccess =
    !isMaster && !isParticipant ? await hasInheritedAccess(task.parentId, userId) : false;

  const canView = isSuperAdmin
    ? true
    : task.visibility === "PUBLIC"
      ? canViewProject
      : isMaster || isParticipant || inheritedAccess;

  const canManage = isMaster;
  const canParticipantAct = isMaster || isParticipant || inheritedAccess;
  const canComment = canView;
  const locked = task.completedAt !== null;
  const canJoin = canView && !isMaster && !isParticipant && !inheritedAccess && !locked;
  const canLeave = isParticipant && !isMaster && !locked;

  return { task, isMaster, isParticipant, canView, canManage, canParticipantAct, canComment, canJoin, canLeave };
}

type TaskWithParticipants = {
  id: string;
  parentId: string | null;
  masterId: string;
  visibility: "PUBLIC" | "PRIVATE";
  participants: { userId: string; includeSubtree: boolean }[];
};

function canViewTask<T extends TaskWithParticipants>(
  task: T,
  byId: Map<string, T>,
  userId: string,
): boolean {
  if (task.visibility === "PUBLIC") return true;
  if (task.masterId === userId) return true;
  if (task.participants.some((p) => p.userId === userId)) return true;

  let current = task.parentId ? byId.get(task.parentId) : undefined;
  while (current) {
    if (current.participants.some((p) => p.userId === userId && p.includeSubtree)) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

export async function listTasksForProject(projectId: string, userId: string, isSuperAdmin: boolean) {
  const allTasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      master: true,
      participants: true,
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (isSuperAdmin) return allTasks;

  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return allTasks.filter((t) => canViewTask(t, byId, userId));
}

export function isOverdue(dueDate: Date | null, status: string) {
  return !!dueDate && dueDate < new Date() && status !== "DONE";
}

export type TaskTreeNode = {
  id: string;
  title: string;
  children: TaskTreeNode[];
};

export function buildSubtree(allTasks: { id: string; title: string; parentId: string | null }[], rootId: string): TaskTreeNode | null {
  const childrenByParent = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    if (!t.parentId) continue;
    const list = childrenByParent.get(t.parentId) ?? [];
    list.push(t);
    childrenByParent.set(t.parentId, list);
  }

  const root = allTasks.find((t) => t.id === rootId);
  if (!root) return null;

  function build(taskId: string, title: string): TaskTreeNode {
    const children = (childrenByParent.get(taskId) ?? []).map((c) => build(c.id, c.title));
    return { id: taskId, title, children };
  }

  return build(root.id, root.title);
}

export function collectSubtreeIds(node: TaskTreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectSubtreeIds(child)) ids.add(id);
  }
  return ids;
}

export function collectDescendantIds(allTasks: { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const t of allTasks) {
    if (!t.parentId) continue;
    const list = childrenByParent.get(t.parentId) ?? [];
    list.push(t.id);
    childrenByParent.set(t.parentId, list);
  }

  const result = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}
