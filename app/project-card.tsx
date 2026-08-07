"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VisibilityForm } from "@/app/projects/[projectId]/visibility-form";
import { ProjectColorForm } from "@/app/projects/[projectId]/project-color-form";
import { IconDotsVertical } from "@tabler/icons-react";

type ProjectCardData = {
  id: string;
  name: string;
  goalDate: Date | null;
  visibility: "PUBLIC" | "PRIVATE";
  isArchived: boolean;
  deletedAt: Date | null;
  color: string | null;
  ownerId: string;
  members: { userId: string; user: { id: string; name: string } }[];
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
          {isOwner && <ProjectSettingsDialog project={project} />}
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

function ProjectSettingsDialog({ project }: { project: ProjectCardData }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            title="프로젝트 설정"
            aria-label="프로젝트 설정"
            className="relative z-10 bg-background"
          >
            <IconDotsVertical />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project.name} 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-foreground">공개 범위</h4>
            <VisibilityForm projectId={project.id} visibility={project.visibility} />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-foreground">프로젝트 색상</h4>
            <ProjectColorForm projectId={project.id} currentColor={project.color} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
