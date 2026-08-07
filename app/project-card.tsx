"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProjectSettingsDialog } from "@/app/projects/[projectId]/project-settings-dialog";

type ProjectCardData = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  isArchived: boolean;
  deletedAt: Date | null;
  color: string | null;
  ownerId: string;
  members: { userId: string; role: "OWNER" | "MEMBER"; user: { id: string; name: string } }[];
  tasks: { status: string }[];
};

export function ProjectCard({
  project,
  currentUserId,
}: {
  project: ProjectCardData;
  currentUserId: string;
}) {
  const hidden = project.isArchived || project.deletedAt !== null;
  const isOwner = project.ownerId === currentUserId;
  const todoCount = project.tasks.filter((t) => t.status === "TODO").length;
  const inProgressCount = project.tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <div
      style={project.color ? { backgroundColor: `color-mix(in oklch, ${project.color} 14%, var(--card))` } : undefined}
      className="relative flex aspect-4/3 flex-col justify-between rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10"
    >
      <Link href={`/projects/${project.id}`} className="absolute inset-0 z-0 rounded-4xl" aria-label={project.name} />

      <div className="relative z-10 flex items-start justify-between gap-2">
        <h3 className="pointer-events-none text-base font-bold">{project.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}
            className="pointer-events-none rounded-full bg-background px-3"
          >
            {project.visibility === "PUBLIC" ? "공개" : "비공개"}
          </Badge>
          {isOwner && (
            <ProjectSettingsDialog project={project} isOwner={isOwner} triggerClassName="relative z-10 bg-background" />
          )}
        </div>
      </div>

      {project.members.length > 0 && (
        <div className="pointer-events-none relative z-10 flex flex-wrap gap-1">
          {project.members.map((m) => (
            <span key={m.userId} className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {m.user.name}
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none relative z-10 space-y-0.5 text-sm text-muted-foreground">
        {hidden && (
          <Badge variant="destructive" className="mb-1 rounded-full">
            {project.deletedAt ? "삭제됨" : "숨김"}
          </Badge>
        )}
        <p>
          업무 {project.tasks.length}개 · 진행전 {todoCount}개 · 진행중 {inProgressCount}개
        </p>
      </div>
    </div>
  );
}
