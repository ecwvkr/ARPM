import { prisma } from "@/lib/prisma";
import { listVisiblePartners } from "@/lib/partners";
import { listProjectsForPartners } from "@/lib/projects";

export type TaskGroupFilters = {
  partnerIds?: string[];
  authorId?: string; // 지정 시 이 사람이 등록한(=담당자) 태스크만. 없으면 전체.
  q?: string;
};

export type GroupedTaskItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: Date;
  completedAt: Date | null;
  createdById: string;
  createdByName: string;
};

export type GroupedTaskProject = {
  id: string;
  partnerId: string;
  title: string;
  status: string;
  tasks: GroupedTaskItem[];
};

export type GroupedTaskPartner = {
  id: string;
  name: string;
  color: string | null;
  projects: GroupedTaskProject[];
};

// 태스크 탭(리스트/보드 공용) 데이터: 볼 수 있는 프로젝트 중 태스크가 하나라도 있는
// 것만 파트너 > 프로젝트 순으로 묶는다. 프로젝트 가시성은 listProjectsForPartners가
// 처리하고, "담당자"(=등록한 사람) 필터는 태스크 쪽에서 직접 건다.
export async function listGroupedTasksForUser(
  userId: string,
  isSuperAdmin: boolean,
  filters: TaskGroupFilters = {},
): Promise<GroupedTaskPartner[]> {
  const partners = await listVisiblePartners(userId, isSuperAdmin, false);
  const projects = await listProjectsForPartners(partners, userId, isSuperAdmin, {
    partnerIds: filters.partnerIds,
  });
  if (projects.length === 0) return [];

  const tasks = await prisma.taskItem.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const tasksByProject = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByProject.get(t.projectId) ?? [];
    list.push(t);
    tasksByProject.set(t.projectId, list);
  }

  const q = filters.q?.trim().toLowerCase();
  const partnersById = new Map(partners.map((p) => [p.id, p]));
  const grouped = new Map<string, GroupedTaskPartner>();

  for (const project of projects) {
    let projectTasks = tasksByProject.get(project.id) ?? [];
    if (projectTasks.length === 0) continue;

    if (filters.authorId) {
      projectTasks = projectTasks.filter((t) => t.createdById === filters.authorId);
      if (projectTasks.length === 0) continue;
    }

    if (q) {
      const projectMatches = project.title.toLowerCase().includes(q);
      if (!projectMatches) {
        projectTasks = projectTasks.filter((t) => t.title.toLowerCase().includes(q));
      }
      if (projectTasks.length === 0) continue;
    }

    // 체크리스트와 같은 규칙: 미완료는 생성 오래된 순으로 위, 완료는 아래로 내린다.
    const sorted = [...projectTasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const partnerMeta = partnersById.get(project.partnerId);
    if (!partnerMeta) continue;

    let bucket = grouped.get(project.partnerId);
    if (!bucket) {
      bucket = { id: project.partnerId, name: partnerMeta.name, color: partnerMeta.color, projects: [] };
      grouped.set(project.partnerId, bucket);
    }
    bucket.projects.push({
      id: project.id,
      partnerId: project.partnerId,
      title: project.title,
      status: project.status,
      tasks: sorted.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        createdById: t.createdById,
        createdByName: t.createdBy.name,
      })),
    });
  }

  return Array.from(grouped.values())
    .map((p) => ({ ...p, projects: p.projects.sort((a, b) => a.title.localeCompare(b.title, "ko")) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

export type FlatTaskRow = {
  partnerId: string;
  partnerName: string;
  projectId: string;
  projectTitle: string;
  task: GroupedTaskItem;
};

// 테이블 뷰용: 파트너 > 프로젝트 그룹을 한 줄(=태스크 1건)짜리 평면 목록으로 편다.
// 정렬 순서는 listGroupedTasksForUser가 이미 잡아둔 순서를 그대로 따른다.
export function flattenGroupedTasks(partners: GroupedTaskPartner[]): FlatTaskRow[] {
  const rows: FlatTaskRow[] = [];
  for (const partner of partners) {
    for (const project of partner.projects) {
      for (const task of project.tasks) {
        rows.push({
          partnerId: partner.id,
          partnerName: partner.name,
          projectId: project.id,
          projectTitle: project.title,
          task,
        });
      }
    }
  }
  return rows;
}
