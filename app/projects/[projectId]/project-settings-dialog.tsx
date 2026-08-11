"use client";

import { useTransition } from "react";
import { removeMember, softDeleteProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProjectNameForm } from "./project-name-form";
import { VisibilityForm } from "./visibility-form";
import { ProjectColorForm } from "./project-color-form";
import { InviteForm } from "./invite-form";
import { IconDotsVertical, IconX } from "@tabler/icons-react";

type ProjectSettingsData = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  color: string | null;
  members: { userId: string; role: "OWNER" | "MEMBER"; user: { id: string; name: string } }[];
};

export function ProjectSettingsDialog({
  project,
  isOwner,
  canDelete = false,
  triggerClassName = "",
}: {
  project: ProjectSettingsData;
  isOwner: boolean;
  canDelete?: boolean;
  triggerClassName?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            title="프로젝트 설정"
            aria-label="프로젝트 설정"
            className={triggerClassName}
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
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">프로젝트 명</h4>
              <ProjectNameForm projectId={project.id} name={project.name} />
            </div>
          )}
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">공개 범위</h4>
              <VisibilityForm projectId={project.id} visibility={project.visibility} />
            </div>
          )}
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">프로젝트 색상</h4>
              <ProjectColorForm projectId={project.id} currentColor={project.color} />
            </div>
          )}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-foreground">멤버 ({project.members.length})</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {project.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2">
                  <span>
                    {m.user.name} · {m.role === "OWNER" ? "owner" : "member"}
                  </span>
                  {isOwner && m.role !== "OWNER" && (
                    <button
                      type="button"
                      aria-label={`${m.user.name} 제외`}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await removeMember(project.id, m.userId);
                        })
                      }
                      className="text-muted-foreground/60 hover:text-destructive"
                    >
                      <IconX className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <InviteForm projectId={project.id} excludeIds={project.members.map((m) => m.userId)} />
            )}
          </div>
          {canDelete && (
            <div className="space-y-1.5 border-t border-foreground/10 pt-4">
              <h4 className="text-sm font-bold text-destructive">프로젝트 삭제</h4>
              <p className="text-xs text-muted-foreground">
                목록에서 사라지지만 데이터는 남아 있어 총관리자가 복구할 수 있습니다.
              </p>
              <form
                action={softDeleteProject.bind(null, project.id)}
                onSubmit={(e) => {
                  if (!confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) e.preventDefault();
                }}
              >
                <Button type="submit" size="sm" variant="destructive">
                  프로젝트 삭제
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
