"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { updateProjectInfo, listMovableTargets, duplicateProject } from "@/app/actions/projects";
import { useDetailSubmit } from "./use-detail-submit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LinkFields } from "@/components/link-fields";
import { ProjectParentPicker } from "@/components/project-parent-picker";
import { DeriveDialog } from "./project-derive-dialog";
import { showToast } from "@/components/ui/global-toast";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { IconPencil, IconCheck, IconX, IconLink, IconPlus, IconCopy } from "@tabler/icons-react";

export function ProjectDetailHeader({
  projectId,
  partnerId,
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
  partnerId: string;
  project: {
    title: string;
    memo: string | null;
    links: string[];
    status: string;
    visibility: "PUBLIC" | "PRIVATE";
    recurrence: string | null;
    dueDate: Date | null;
    parentId: string | null;
    parent: { id: string; title: string } | null;
    children: { id: string; title: string; status: string }[];
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
      <EditForm
        projectId={projectId}
        project={project}
        errorMessage={errorMessage}
        isPending={isPending}
        onSubmit={(formData) =>
          submit(formData, () => {
            setEditing(false);
            showToast("저장되었습니다");
            onSaved();
          })
        }
        onCancel={() => setEditing(false)}
      />
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
        {/* 하위 추가·복제는 더보기 메뉴에서 꺼내 수정 버튼 옆에 나란히 둔다. */}
        {canManage && !locked && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              title="수정"
              aria-label="프로젝트 정보 수정"
              onClick={() => setEditing(true)}
            >
              <IconPencil />
            </Button>
            <DeriveDialog
              parentProjectId={projectId}
              onDone={onSaved}
              trigger={
                <Button size="icon-sm" variant="ghost" title="하위 프로젝트 추가" aria-label="하위 프로젝트 추가">
                  <IconPlus />
                </Button>
              }
            />
            <DuplicateButton projectId={projectId} onDone={onSaved} />
          </div>
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
      {project.parent && (
        <p className="text-xs text-muted-foreground">
          상위 프로젝트:{" "}
          <Link href={`/partners/${partnerId}?project=${project.parent.id}`} className="hover:underline">
            {project.parent.title}
          </Link>
        </p>
      )}
      {project.children.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
          하위 프로젝트:
          {project.children.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>·</span>}
              <Link
                href={`/partners/${partnerId}?project=${c.id}`}
                className={`hover:underline ${c.status === "DONE" ? "line-through" : ""}`}
              >
                {c.title}
              </Link>
            </span>
          ))}
        </p>
      )}
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

function DuplicateButton({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      title="프로젝트 복제"
      aria-label="프로젝트 복제"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await duplicateProject(projectId);
          showToast("복제되었습니다");
          onDone();
        })
      }
    >
      <IconCopy />
    </Button>
  );
}

// 상위 프로젝트 변경은 별도 팝업 대신 이 수정 폼 안에서 함께 처리한다.
function EditForm({
  projectId,
  project,
  errorMessage,
  isPending,
  onSubmit,
  onCancel,
}: {
  projectId: string;
  project: {
    title: string;
    memo: string | null;
    links: string[];
    parentId: string | null;
  };
  errorMessage: string | undefined;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [targets, setTargets] = useState<{ id: string; title: string }[] | null>(null);

  useEffect(() => {
    listMovableTargets(projectId).then(setTargets);
  }, [projectId]);

  return (
    <form action={onSubmit} className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Input name="title" defaultValue={project.title} required className="text-base font-bold" />
        {/* 수정 버튼과 같은 자리에서 저장/취소로 전환 — 별도 폼 레이아웃으로 안 튀게 한다. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button type="submit" size="icon-sm" variant="ghost" title="저장" aria-label="저장" disabled={isPending}>
            <IconCheck />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" title="취소" aria-label="취소" onClick={onCancel}>
            <IconX />
          </Button>
        </div>
      </div>
      <Textarea name="memo" defaultValue={project.memo ?? ""} placeholder="상세" rows={3} required />
      <LinkFields defaultLinks={project.links} />
      <div className="space-y-1.5">
        <Label>상위 프로젝트</Label>
        {targets === null ? (
          <p className="text-xs text-muted-foreground">불러오는 중...</p>
        ) : (
          <ProjectParentPicker
            name="parentId"
            options={targets}
            defaultId={project.parentId}
            placeholder="상위 프로젝트 검색 (비우면 최상위)"
          />
        )}
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
