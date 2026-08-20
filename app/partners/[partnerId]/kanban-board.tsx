"use client";

import { updateProjectStatus, completeProject } from "@/app/actions/projects";
import { STATUS_LABEL, isOverdue, buildParticipantChips, isProjectUnread } from "@/lib/priority";
import { ProjectCard } from "./project-card";
import type { PartnerProjectSummary } from "./project-list";

const COLUMNS = [
  { status: "TODO" as const, label: STATUS_LABEL.TODO },
  { status: "IN_PROGRESS" as const, label: STATUS_LABEL.IN_PROGRESS },
  { status: "DONE" as const, label: STATUS_LABEL.DONE },
];

export function KanbanBoard({
  projects,
  currentUserId,
}: {
  projects: PartnerProjectSummary[];
  currentUserId: string;
}) {
  // ponytail: updateProjectStatus/completeProject는 내부에서 revalidatePath를 호출하므로
  // Next가 현재 페이지를 이미 자동 갱신한다. router.refresh()는 중복 새로고침이라 제거.
  async function handleDrop(projectId: string, target: "TODO" | "IN_PROGRESS" | "DONE") {
    try {
      if (target === "DONE") await completeProject(projectId);
      else await updateProjectStatus(projectId, target);
    } catch {
      alert("상태를 변경할 수 없습니다. 권한을 확인하세요.");
    }
  }

  return (
    <div className="hidden gap-4 lg:grid lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const colProjects = projects.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const projectId = e.dataTransfer.getData("text/plain");
              if (projectId) handleDrop(projectId, col.status);
            }}
            className="space-y-2 rounded-xl border-[0.5px] bg-muted/30 p-3"
          >
            <h3 className="text-sm font-medium">
              {col.label} ({colProjects.length})
            </h3>
            <div className="space-y-2">
              {colProjects.map((project) => (
                <div
                  key={project.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", project.id)}
                >
                  <ProjectCard
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
                    unread={isProjectUnread(project, currentUserId)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
