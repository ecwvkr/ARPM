"use client";

import { useState } from "react";
import { updateProjectInfo } from "@/app/actions/projects";
import { useDetailSubmit } from "./use-detail-submit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkFields } from "@/components/link-fields";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { IconPencil, IconCheck, IconX, IconLink } from "@tabler/icons-react";

export function ProjectDetailHeader({
  projectId,
  project,
  canManage,
  locked,
  isViewer,
  isNew,
  isEdited,
  recentChanges,
  onSaved,
}: {
  projectId: string;
  project: {
    title: string;
    memo: string | null;
    links: string[];
    status: string;
    visibility: "PUBLIC" | "PRIVATE";
    recurrence: string | null;
    dueDate: Date | null;
    parent: { title: string } | null;
  };
  canManage: boolean;
  locked: boolean;
  isViewer: boolean;
  isNew: boolean;
  isEdited: boolean;
  recentChanges: { id: string; message: string; actorName: string; createdAt: Date }[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { errorMessage, isPending, submit } = useDetailSubmit(updateProjectInfo.bind(null, projectId));
  const overdue = isOverdue(project.dueDate, project.status);

  if (editing) {
    return (
      <form
        action={(formData) =>
          submit(formData, () => {
            setEditing(false);
            onSaved();
          })
        }
        className="space-y-2"
      >
        <div className="flex items-start justify-between gap-2">
          <Input name="title" defaultValue={project.title} required className="text-base font-bold" />
          {/* 수정 버튼과 같은 자리에서 저장/취소로 전환 — 별도 폼 레이아웃으로 안 튀게 한다. */}
          <div className="flex shrink-0 items-center gap-1">
            <Button type="submit" size="icon-sm" variant="ghost" title="저장" aria-label="저장" disabled={isPending}>
              <IconCheck />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="취소"
              aria-label="취소"
              onClick={() => setEditing(false)}
            >
              <IconX />
            </Button>
          </div>
        </div>
        <Textarea name="memo" defaultValue={project.memo ?? ""} placeholder="상세" rows={3} required />
        <LinkFields defaultLinks={project.links} />
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isNew && <Badge variant="destructive">신규</Badge>}
          {isEdited && <Badge variant="outline">수정됨</Badge>}
          <h2 className="text-lg font-bold">{project.title}</h2>
          <Badge variant={project.status === "DONE" ? "secondary" : "default"}>
            {STATUS_LABEL[project.status]}
          </Badge>
          {overdue && <Badge variant="destructive">지연</Badge>}
          <Badge variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}>
            {project.visibility === "PUBLIC" ? "공개" : "비공개"}
          </Badge>
          {project.recurrence === "WEEKLY" && <Badge variant="outline">매주 반복</Badge>}
          {isViewer && <Badge variant="outline">읽기 전용</Badge>}
        </div>
        {canManage && !locked && (
          <Button
            size="icon-sm"
            variant="ghost"
            title="수정"
            aria-label="프로젝트 정보 수정"
            onClick={() => setEditing(true)}
          >
            <IconPencil />
          </Button>
        )}
      </div>
      {project.memo && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{project.memo}</p>}
      {project.links.map((link) => (
        <a
          key={link}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit max-w-full items-center gap-1 text-sm text-primary underline underline-offset-2"
        >
          <IconLink className="size-4 shrink-0" />
          {/* flex 자식은 기본 min-width:auto라 끊을 곳 없는 긴 URL이 줄어들지 않고
              모달을 밀어내 좌우 스크롤을 만든다. min-w-0이라야 truncate가 먹는다. */}
          <span className="min-w-0 truncate">{link}</span>
        </a>
      ))}
      {project.parent && <p className="text-xs text-muted-foreground">상위 프로젝트: {project.parent.title}</p>}
      {isEdited && recentChanges.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer underline underline-offset-2">수정 내역</summary>
          <ul className="mt-1.5 space-y-1">
            {recentChanges.map((c) => (
              <li key={c.id}>
                <span className="text-foreground">{c.actorName}</span> · {c.message} ·{" "}
                {new Date(c.createdAt).toLocaleString("ko-KR")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
