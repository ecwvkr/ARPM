import { IconFolder, IconChevronRight } from "@tabler/icons-react";
import { isProjectUnread, type listProjectsForPartners } from "@/lib/projects";
import { isOverdue, buildParticipantChips, canJoinProject } from "@/lib/priority";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";

type GroupProject = Awaited<ReturnType<typeof listProjectsForPartners>>[number];

// 보드 뷰(파트너별): 진행여부별 보드와 같은 카드를 파트너 단위 아코디언으로 묶는다.
// 태스크 보드 뷰와 같은 캐럿·폴더 헤더를 쓴다.
export function ProjectPartnerGroupsView({
  projects,
  currentUserId,
  memberPartnerIds,
}: {
  projects: GroupProject[];
  currentUserId: string;
  memberPartnerIds: Set<string>;
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">조건에 맞는 프로젝트가 없습니다.</p>;
  }

  const groups = new Map<string, { name: string; color: string | null; projects: GroupProject[] }>();
  for (const project of projects) {
    const group = groups.get(project.partnerId);
    if (group) group.projects.push(project);
    else
      groups.set(project.partnerId, {
        name: project.partnerName,
        color: project.partnerColor,
        projects: [project],
      });
  }
  const ordered = [...groups.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "ko"));

  return (
    <div className="space-y-4">
      {ordered.map(([partnerId, group]) => (
        <details key={partnerId} open className="group/partner">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-bold">
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/partner:rotate-90" />
            <IconFolder className="size-4 shrink-0" style={{ color: group.color ?? undefined }} />
            <span style={{ color: group.color ?? undefined }}>{group.name}</span>
            <span className="font-normal text-muted-foreground">({group.projects.length})</span>
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
            {group.projects.map((project) => (
              <ProjectCard
                key={project.id}
                projectId={project.id}
                partnerId={project.partnerId}
                title={project.title}
                status={project.status}
                overdue={isOverdue(project.dueDate, project.status)}
                createdAt={project.createdAt}
                dueDate={project.dueDate}
                participants={buildParticipantChips(project)}
                commentCount={project._count.comments}
                currentUserId={currentUserId}
                links={project.links}
                unread={isProjectUnread(project, currentUserId)}
                pinned={project.pins.length > 0}
                canJoin={canJoinProject(project, currentUserId, memberPartnerIds.has(project.partnerId))}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
