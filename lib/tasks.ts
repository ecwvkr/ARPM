import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";
import { listVisibleProjects } from "@/lib/projects";

export { isOverdue, isTaskUnread } from "@/lib/priority";

const PRIORITY_RANK: Record<string, number> = { URGENT: 3, NORMAL: 2, HOLD: 1 };

export function getMaxPriority(priorities: { level: string }[]): string {
  if (priorities.length === 0) return "HOLD";
  return priorities.reduce(
    (max, p) => (PRIORITY_RANK[p.level] > PRIORITY_RANK[max] ? p.level : max),
    "HOLD",
  );
}

export function sortTasks<
  T extends { dueDate: Date | null; createdAt: Date; priorities: { level: string }[] },
>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueDate ? a.dueDate.getTime() : Infinity;
    const bDue = b.dueDate ? b.dueDate.getTime() : Infinity;
    if (aDue !== bDue) return aDue - bDue;

    const aPriority = PRIORITY_RANK[getMaxPriority(a.priorities)];
    const bPriority = PRIORITY_RANK[getMaxPriority(b.priorities)];
    if (aPriority !== bPriority) return bPriority - aPriority;

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

// 가장 가까운 조상의 grant가 우선한다: 전체 공유(true) 상속 도중 특정 가지에 false grant를
// 두면 그 아래는 차단된다("공유 제외" — §Phase5). 조상에 grant가 전혀 없으면 다음 조상으로 계속.
// ponytail: 조상 단계마다 DB 왕복하는 대신 프로젝트의 트리를 한 번에 읽어 메모리에서 걷는다.
async function hasInheritedAccess(
  projectId: string,
  startParentId: string | null,
  userId: string,
): Promise<boolean> {
  if (!startParentId) return false;

  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      parentId: true,
      participants: { where: { userId }, select: { includeSubtree: true } },
    },
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));

  let current = byId.get(startParentId);
  while (current) {
    if (current.participants.length > 0) return current.participants[0].includeSubtree;
    current = current.parentId ? byId.get(current.parentId) : undefined;
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
      priorities: { include: { user: true } },
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

  const isMaster = task.masterId === userId;
  const ownGrant = task.participants.find((p) => p.userId === userId);
  // 조상이 이미 true로 포함하고 있는데 이 노드에 false grant가 있다면 "가지 제외"로 보고
  // 이 노드부터 차단한다. 조상 grant가 없다면(=단독 초대) false는 "이 업무만 공유"로 취급한다.
  // ponytail: 서로 의존하지 않는 두 조회를 병렬로 실행해 순차 왕복을 줄인다.
  const [{ canView: canViewProject }, inheritedWouldGrant] = await Promise.all([
    getProjectAccess(task.projectId, userId, isSuperAdmin),
    isMaster ? Promise.resolve(false) : hasInheritedAccess(task.projectId, task.parentId, userId),
  ]);
  const grantedAccess = ownGrant
    ? ownGrant.includeSubtree || !inheritedWouldGrant
    : inheritedWouldGrant;
  const isParticipant = !!ownGrant && grantedAccess;

  const canView = isSuperAdmin
    ? true
    : task.visibility === "PUBLIC"
      ? canViewProject
      : isMaster || grantedAccess;

  const canManage = isMaster;
  const canParticipantAct = isMaster || grantedAccess;
  const canComment = canView;
  const locked = task.completedAt !== null;
  const canJoin = canView && !isMaster && !grantedAccess && !locked;
  const canLeave = isParticipant && !isMaster && !locked;

  return {
    task,
    isMaster,
    isParticipant,
    canView,
    canManage,
    canParticipantAct,
    canComment,
    canJoin,
    canLeave,
  };
}

type TaskWithParticipants = {
  id: string;
  parentId: string | null;
  masterId: string;
  visibility: "PUBLIC" | "PRIVATE";
  participants: { userId: string; includeSubtree: boolean }[];
};

function nearestAncestorGrant<T extends TaskWithParticipants>(
  task: T,
  byId: Map<string, T>,
  userId: string,
): boolean {
  let current = task.parentId ? byId.get(task.parentId) : undefined;
  while (current) {
    const grant = current.participants.find((p) => p.userId === userId);
    if (grant) return grant.includeSubtree;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function canViewTask<T extends TaskWithParticipants>(
  task: T,
  byId: Map<string, T>,
  userId: string,
): boolean {
  if (task.visibility === "PUBLIC") return true;
  if (task.masterId === userId) return true;

  const inheritedWouldGrant = nearestAncestorGrant(task, byId, userId);
  const ownGrant = task.participants.find((p) => p.userId === userId);

  // 조상이 이미 포함(true)하는데 이 노드에 false grant가 있으면 "가지 제외"로 차단.
  // 조상 grant가 없다면 false는 "이 업무만 공유"로 취급해 이 노드는 보인다.
  if (ownGrant) return ownGrant.includeSubtree || !inheritedWouldGrant;
  return inheritedWouldGrant;
}

function taskListInclude(userId: string) {
  return {
    master: true,
    participants: { include: { user: true } },
    priorities: { include: { user: true } },
    _count: { select: { comments: true } },
    comments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { createdAt: true } },
    reads: { where: { userId }, select: { lastReadAt: true } },
  };
}

// parentId는 항상 같은 프로젝트 내 업무만 가리키므로(스키마 제약), 여러 프로젝트의
// 업무를 한 배열에 섞어 넣어도 조상 추적(byId)이 다른 프로젝트로 새지 않는다.
function filterVisibleTasks<T extends TaskWithParticipants>(
  tasks: T[],
  userId: string,
  isSuperAdmin: boolean,
): T[] {
  if (isSuperAdmin) return tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks.filter((t) => canViewTask(t, byId, userId));
}

export async function listTasksForProject(projectId: string, userId: string, isSuperAdmin: boolean) {
  const allTasks = await prisma.task.findMany({
    where: { projectId },
    include: taskListInclude(userId),
    orderBy: { createdAt: "asc" },
  });

  return sortTasks(filterVisibleTasks(allTasks, userId, isSuperAdmin));
}

export async function listAllTasksForUser(
  userId: string,
  isSuperAdmin: boolean,
  filters: {
    projectId?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    mineOnly?: boolean;
    q?: string;
  } = {},
) {
  const projects = await listVisibleProjects(userId, isSuperAdmin, false);
  return listTasksForProjects(projects, userId, isSuperAdmin, filters);
}

// listAllTasksForUser에서 프로젝트 조회 부분만 뽑아낸 버전. 호출 측이 이미
// listVisibleProjects를 한 번 가져온 경우(대시보드, 전체 업무 화면) 여기로 그대로
// 넘겨서 같은 프로젝트 쿼리를 중복 실행하지 않는다.
export async function listTasksForProjects(
  projects: { id: string; name: string; color: string | null }[],
  userId: string,
  isSuperAdmin: boolean,
  filters: {
    projectId?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    mineOnly?: boolean;
    q?: string;
  } = {},
) {
  const targetProjects = filters.projectId
    ? projects.filter((p) => p.id === filters.projectId)
    : projects;
  const projectMeta = new Map(targetProjects.map((p) => [p.id, { name: p.name, color: p.color }]));

  // ponytail: 프로젝트마다 따로 조회하던 N+1을 projectId IN 배열 한 방 쿼리로 바꾸고,
  // 가시성 필터링은 메모리에서 처리한다.
  const allTasks = await prisma.task.findMany({
    where: { projectId: { in: targetProjects.map((p) => p.id) } },
    include: taskListInclude(userId),
    orderBy: { createdAt: "asc" },
  });

  let tasks = filterVisibleTasks(allTasks, userId, isSuperAdmin).map((t) => {
    const meta = projectMeta.get(t.projectId)!;
    return { ...t, projectName: meta.name, projectColor: meta.color };
  });

  if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    tasks = tasks.filter((t) => t.title.toLowerCase().includes(q));
  }
  if (filters.mineOnly) {
    tasks = tasks.filter(
      (t) => t.masterId === userId || t.participants.some((p) => p.userId === userId),
    );
  }

  return sortTasks(tasks);
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
