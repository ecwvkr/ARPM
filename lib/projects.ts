import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";
import { listVisiblePartners } from "@/lib/partners";

export { isOverdue, isProjectUnread } from "@/lib/priority";

const PRIORITY_RANK: Record<string, number> = { URGENT: 3, NORMAL: 2, HOLD: 1 };

export function getMaxPriority(priorities: { level: string }[]): string {
  if (priorities.length === 0) return "HOLD";
  return priorities.reduce(
    (max, p) => (PRIORITY_RANK[p.level] > PRIORITY_RANK[max] ? p.level : max),
    "HOLD",
  );
}

export function sortProjects<
  T extends { dueDate: Date | null; createdAt: Date; priorities: { level: string }[] },
>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
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
// role(VIEWER/MEMBER, D4)도 grant와 함께 상속된다 — 조상에서 VIEWER로 초대되면 그 하위
// 트리 전체도 기본은 VIEWER다.
// ponytail: 조상 단계마다 DB 왕복하는 대신 파트너의 트리를 한 번에 읽어 메모리에서 걷는다.
async function hasInheritedAccess(
  partnerId: string,
  startParentId: string | null,
  userId: string,
): Promise<{ includeSubtree: boolean; role: "MEMBER" | "VIEWER" } | null> {
  if (!startParentId) return null;

  const projects = await prisma.project.findMany({
    where: { partnerId, deletedAt: null },
    select: {
      id: true,
      parentId: true,
      participants: { where: { userId }, select: { includeSubtree: true, role: true } },
    },
  });
  const byId = new Map(projects.map((t) => [t.id, t]));

  let current = byId.get(startParentId);
  while (current) {
    if (current.participants.length > 0) {
      const g = current.participants[0];
      return { includeSubtree: g.includeSubtree, role: g.role };
    }
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

export async function getProjectAccess(projectId: string, userId: string, isSuperAdmin: boolean) {
  // deletedAt이 있는(보관함) 프로젝트는 일반 조회에서 "없음"과 동일하게 취급한다.
  // 복구·영구삭제는 별도 경로(app/actions/partners.ts의 보관함 액션)에서 다룬다.
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      master: true,
      parent: { select: { id: true, title: true } },
      participants: { include: { user: true } },
      priorities: { include: { user: true } },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      partner: true,
    },
  });

  if (!project) {
    return {
      project: null,
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

  const isMaster = project.masterId === userId;
  const ownGrant = project.participants.find((p) => p.userId === userId);
  // 조상이 이미 true로 포함하고 있는데 이 노드에 false grant가 있다면 "가지 제외"로 보고
  // 이 노드부터 차단한다. 조상 grant가 없다면(=단독 초대) false는 "이 프로젝트만 공유"로 취급한다.
  // ponytail: 서로 의존하지 않는 두 조회를 병렬로 실행해 순차 왕복을 줄인다.
  const [{ canView: canViewPartner }, inherited] = await Promise.all([
    getPartnerAccess(project.partnerId, userId, isSuperAdmin),
    isMaster ? Promise.resolve(null) : hasInheritedAccess(project.partnerId, project.parentId, userId),
  ]);
  const inheritedWouldGrant = inherited?.includeSubtree ?? false;
  const grantedAccess = ownGrant
    ? ownGrant.includeSubtree || !inheritedWouldGrant
    : inheritedWouldGrant;
  const isParticipant = !!ownGrant && grantedAccess;
  // role은 직접 grant가 있으면 그걸, 없으면(상속) 조상의 role을 따른다(D4).
  const grantedRole = ownGrant ? ownGrant.role : inherited?.role;
  const isViewer = grantedAccess && !isMaster && grantedRole === "VIEWER";

  const canView = isSuperAdmin
    ? true
    : project.visibility === "PUBLIC"
      ? canViewPartner
      : isMaster || grantedAccess;

  const canManage = isMaster;
  // VIEWER는 조회·코멘트만 가능하고 상태 변경·우선순위·마감 연장 등은 할 수 없다(D4).
  const canParticipantAct = (isMaster || grantedAccess) && !isViewer;
  const canComment = canView;
  const locked = project.completedAt !== null;
  const canJoin = canView && !isMaster && !grantedAccess && !locked;
  const canLeave = isParticipant && !isMaster && !locked;

  return {
    project,
    isMaster,
    isParticipant,
    isViewer,
    canView,
    canManage,
    canParticipantAct,
    canComment,
    canJoin,
    canLeave,
  };
}

type ProjectWithParticipants = {
  id: string;
  parentId: string | null;
  masterId: string;
  visibility: "PUBLIC" | "PRIVATE";
  participants: { userId: string; includeSubtree: boolean }[];
};

function nearestAncestorGrant<T extends ProjectWithParticipants>(
  project: T,
  byId: Map<string, T>,
  userId: string,
): boolean {
  let current = project.parentId ? byId.get(project.parentId) : undefined;
  while (current) {
    const grant = current.participants.find((p) => p.userId === userId);
    if (grant) return grant.includeSubtree;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function canViewProject<T extends ProjectWithParticipants>(
  project: T,
  byId: Map<string, T>,
  userId: string,
): boolean {
  if (project.visibility === "PUBLIC") return true;
  if (project.masterId === userId) return true;

  const inheritedWouldGrant = nearestAncestorGrant(project, byId, userId);
  const ownGrant = project.participants.find((p) => p.userId === userId);

  // 조상이 이미 포함(true)하는데 이 노드에 false grant가 있으면 "가지 제외"로 차단.
  // 조상 grant가 없다면 false는 "이 프로젝트만 공유"로 취급해 이 노드는 보인다.
  if (ownGrant) return ownGrant.includeSubtree || !inheritedWouldGrant;
  return inheritedWouldGrant;
}

function projectListInclude(userId: string) {
  return {
    master: true,
    participants: { include: { user: true } },
    priorities: { include: { user: true } },
    _count: { select: { comments: true } },
    comments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { createdAt: true } },
    reads: { where: { userId }, select: { lastReadAt: true } },
  };
}

// parentId는 항상 같은 파트너 내 프로젝트만 가리키므로(스키마 제약), 여러 파트너의
// 프로젝트를 한 배열에 섞어 넣어도 조상 추적(byId)이 다른 파트너로 새지 않는다.
function filterVisibleProjects<T extends ProjectWithParticipants>(
  projects: T[],
  userId: string,
  isSuperAdmin: boolean,
): T[] {
  if (isSuperAdmin) return projects;
  const byId = new Map(projects.map((t) => [t.id, t]));
  return projects.filter((t) => canViewProject(t, byId, userId));
}

// relationJoins가 켜져 있어 include의 기본 전략은 join(LATERAL JOIN 한 방)이다.
// 목록은 예외로 관계별 개별 쿼리(query)를 쓴다 — 결과가 커질수록 join의 JSON 집계
// 비용이 왕복 절감을 넘어서기 때문. 실측(프로젝트 1건당 참여자/우선순위/코멘트 포함):
//   50건 join 17ms / query 38ms · 500건 join 76ms / query 66ms
//   1000건 join 141ms / query 86ms · 2000건 join 275ms / query 153ms
// 프로젝트가 늘어나는 방향이므로 목록은 query로 고정한다.
const LIST_LOAD_STRATEGY = "query" as const;

export async function listProjectsForPartner(partnerId: string, userId: string, isSuperAdmin: boolean) {
  const allProjects = await prisma.project.findMany({
    where: { partnerId, deletedAt: null },
    include: projectListInclude(userId),
    orderBy: { createdAt: "asc" },
    relationLoadStrategy: LIST_LOAD_STRATEGY,
  });

  return sortProjects(filterVisibleProjects(allProjects, userId, isSuperAdmin));
}

// 캔버스는 노드를 그리는 데 필요한 스칼라 필드와, 가시성 판정에 필요한 participants만
// 있으면 된다. 목록용 조회(projectListInclude)는 master·우선순위·코멘트·읽음까지 끌어오는데
// 캔버스에서는 전부 버려지므로 쓰지 않는다.
export async function listCanvasProjectsForPartners(
  partnerIds: string[],
  userId: string,
  isSuperAdmin: boolean,
) {
  const projects = await prisma.project.findMany({
    where: { partnerId: { in: partnerIds }, deletedAt: null },
    select: {
      id: true,
      parentId: true,
      masterId: true,
      partnerId: true,
      title: true,
      status: true,
      visibility: true,
      dueDate: true,
      canvasX: true,
      canvasY: true,
      participants: { select: { userId: true, includeSubtree: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return filterVisibleProjects(projects, userId, isSuperAdmin);
}

export function listCanvasProjectsForPartner(partnerId: string, userId: string, isSuperAdmin: boolean) {
  return listCanvasProjectsForPartners([partnerId], userId, isSuperAdmin);
}

export async function listAllProjectsForUser(
  userId: string,
  isSuperAdmin: boolean,
  filters: {
    partnerId?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    mineOnly?: boolean;
    q?: string;
  } = {},
) {
  const partners = await listVisiblePartners(userId, isSuperAdmin, false);
  return listProjectsForPartners(partners, userId, isSuperAdmin, filters);
}

// listAllProjectsForUser에서 파트너 조회 부분만 뽑아낸 버전. 호출 측이 이미
// listVisiblePartners를 한 번 가져온 경우(대시보드, 전체 프로젝트 화면) 여기로 그대로
// 넘겨서 같은 파트너 쿼리를 중복 실행하지 않는다.
export async function listProjectsForPartners(
  partners: { id: string; name: string; color: string | null }[],
  userId: string,
  isSuperAdmin: boolean,
  filters: {
    partnerId?: string;
    status?: "TODO" | "IN_PROGRESS" | "DONE";
    mineOnly?: boolean;
    q?: string;
  } = {},
) {
  const targetPartners = filters.partnerId
    ? partners.filter((p) => p.id === filters.partnerId)
    : partners;
  const partnerMeta = new Map(targetPartners.map((p) => [p.id, { name: p.name, color: p.color }]));

  // ponytail: 파트너마다 따로 조회하던 N+1을 partnerId IN 배열 한 방 쿼리로 바꾸고,
  // 가시성 필터링은 메모리에서 처리한다.
  const allProjects = await prisma.project.findMany({
    where: { partnerId: { in: targetPartners.map((p) => p.id) }, deletedAt: null },
    include: projectListInclude(userId),
    orderBy: { createdAt: "asc" },
    relationLoadStrategy: LIST_LOAD_STRATEGY,
  });

  let projects = filterVisibleProjects(allProjects, userId, isSuperAdmin).map((t) => {
    const meta = partnerMeta.get(t.partnerId)!;
    return { ...t, partnerName: meta.name, partnerColor: meta.color };
  });

  if (filters.status) projects = projects.filter((t) => t.status === filters.status);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    projects = projects.filter((t) => t.title.toLowerCase().includes(q));
  }
  if (filters.mineOnly) {
    projects = projects.filter(
      (t) => t.masterId === userId || t.participants.some((p) => p.userId === userId),
    );
  }

  return sortProjects(projects);
}

// 설정 > 보관함(휴지통)에서 쓰는 목록. superAdmin은 전체, 그 외는 본인이 master이거나
// 본인이 owner인 파트너 소속의 보관된 프로젝트만.
export async function listTrashedProjects(userId: string, isSuperAdmin: boolean) {
  const ownedPartnerIds = isSuperAdmin
    ? []
    : (await prisma.partner.findMany({ where: { ownerId: userId }, select: { id: true } })).map((p) => p.id);

  return prisma.project.findMany({
    where: {
      deletedAt: { not: null },
      ...(isSuperAdmin ? {} : { OR: [{ masterId: userId }, { partnerId: { in: ownedPartnerIds } }] }),
    },
    select: {
      id: true,
      title: true,
      deletedAt: true,
      partner: { select: { id: true, name: true, color: true } },
    },
    orderBy: { deletedAt: "desc" },
  });
}

export type ProjectTreeNode = {
  id: string;
  title: string;
  children: ProjectTreeNode[];
};

export function buildSubtree(allProjects: { id: string; title: string; parentId: string | null }[], rootId: string): ProjectTreeNode | null {
  const childrenByParent = new Map<string, typeof allProjects>();
  for (const t of allProjects) {
    if (!t.parentId) continue;
    const list = childrenByParent.get(t.parentId) ?? [];
    list.push(t);
    childrenByParent.set(t.parentId, list);
  }

  const root = allProjects.find((t) => t.id === rootId);
  if (!root) return null;

  function build(projectId: string, title: string): ProjectTreeNode {
    const children = (childrenByParent.get(projectId) ?? []).map((c) => build(c.id, c.title));
    return { id: projectId, title, children };
  }

  return build(root.id, root.title);
}

export function collectSubtreeIds(node: ProjectTreeNode): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const child of node.children) {
    for (const id of collectSubtreeIds(child)) ids.add(id);
  }
  return ids;
}

export function collectDescendantIds(allProjects: { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const t of allProjects) {
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
