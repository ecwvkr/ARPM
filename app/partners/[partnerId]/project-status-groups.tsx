import { listProjectsForPartner, isProjectUnread } from "@/lib/projects";
import { STATUS_LABEL, isOverdue, buildParticipantChips } from "@/lib/priority";
import { ProjectCard } from "./project-card";

const GROUPS = [
  { status: "IN_PROGRESS" as const, label: STATUS_LABEL.IN_PROGRESS },
  { status: "TODO" as const, label: STATUS_LABEL.TODO },
  { status: "DONE" as const, label: STATUS_LABEL.DONE },
];

export async function ProjectStatusGroups({
  partnerId,
  userId,
  isSuperAdmin,
}: {
  partnerId: string;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const projects = await listProjectsForPartner(partnerId, userId, isSuperAdmin);
  return <ProjectStatusGroupsView projects={projects} currentUserId={userId} />;
}

// 이미 프로젝트를 가져온 화면(전체 프로젝트)이 같은 쿼리를 다시 돌리지 않도록 표시 부분만 분리.
type GroupProject = Awaited<ReturnType<typeof listProjectsForPartner>>[number] & {
  partnerName?: string;
  partnerColor?: string | null;
};

export function ProjectStatusGroupsView({
  projects,
  currentUserId,
}: {
  projects: GroupProject[];
  currentUserId: string;
}) {
  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {GROUPS.map((group) => {
        const groupProjects = projects.filter((t) => t.status === group.status);
        return (
          <details
            key={group.status}
            className="overflow-hidden rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10"
            open={group.status !== "DONE"}
          >
            <summary className="sticky top-0 z-10 cursor-pointer bg-card px-4 py-3 text-sm font-medium">
              {group.label} ({groupProjects.length})
            </summary>
            {groupProjects.length > 0 && (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    projectId={project.id}
                    partnerId={project.partnerId}
                    title={project.title}
                    status={project.status}
                    visibility={project.visibility}
                    overdue={isOverdue(project.dueDate, project.status)}
                    createdAt={project.createdAt}
                    dueDate={project.dueDate}
                    participants={buildParticipantChips(project)}
                    commentCount={project._count.comments}
                    currentUserId={currentUserId}
                    partnerName={project.partnerName}
                    partnerColor={project.partnerColor}
                    links={project.links}
                    unread={isProjectUnread(project, currentUserId)}
                  />
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
