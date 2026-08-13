"use client";

import { useState } from "react";
import { STATUS_LABEL, STATUS_ORDER, isOverdue, buildParticipantChips, isProjectUnread } from "@/lib/priority";
import { ProjectCard } from "./project-card";
import type { PartnerProjectSummary } from "./project-list";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export function ProjectListFilterable({
  projects,
  currentUserId,
}: {
  projects: PartnerProjectSummary[];
  currentUserId: string;
}) {
  const [active, setActive] = useState<Set<string>>(new Set());

  function toggle(status: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const visible = active.size === 0 ? projects : projects.filter((t) => active.has(t.status));
  const sorted = [...visible].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={active.has(s)}
            onClick={() => toggle(s)}
            className={
              active.has(s)
                ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">조건에 맞는 프로젝트가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((project) => (
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
              links={project.links}
              unread={isProjectUnread(project, currentUserId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
