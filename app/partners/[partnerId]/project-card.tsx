"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { duplicateProject } from "@/app/actions/projects";
import type { ParticipantChipData } from "@/lib/priority";
import { ParticipantPriorityDot } from "./project-priority-picker";
import { DeriveDialog } from "./project-derive-dialog";
import { DeleteDialog } from "./project-delete-dialog";
import { ProjectDetail } from "./project-detail";
import { IconDotsVertical, IconPlus, IconCopy, IconLink, IconTrash, IconFolder } from "@tabler/icons-react";

function formatShortDate(date: Date) {
  const d = new Date(date);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// 카드는 좁으므로 전체 URL 대신 도메인만 보여준다(전체는 title 툴팁으로).
function linkLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ProjectCard({
  projectId,
  partnerId,
  title,
  statusLabel,
  visibility,
  overdue,
  createdAt,
  dueDate,
  participants,
  commentCount,
  currentUserId,
  partnerName,
  partnerColor,
  links = [],
  unread,
}: {
  projectId: string;
  partnerId: string;
  title: string;
  statusLabel: string;
  visibility: "PUBLIC" | "PRIVATE";
  overdue: boolean;
  createdAt: Date;
  dueDate: Date | null;
  participants: ParticipantChipData[];
  commentCount: number;
  currentUserId: string;
  partnerName?: string;
  partnerColor?: string | null;
  links?: string[];
  unread?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const done = statusLabel === "완료";

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        className={`relative flex flex-col gap-2 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10 ${
          done ? "opacity-60 grayscale" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 z-0 rounded-4xl text-left"
          aria-label={title}
        />

        {unread && (
          <span
            aria-label="읽지 않은 내용이 있습니다"
            title="읽지 않은 내용이 있습니다"
            className="absolute top-3 right-3 z-10 size-2.5 rounded-full bg-destructive ring-2 ring-card"
          />
        )}

        {/* pointer-events-none은 하위로 상속되므로, 실제 클릭이 필요한 요소만
            아래에서 각각 pointer-events-auto로 되돌린다. 그 외 영역은 클릭이
            투과되어 카드 전체를 덮은 상세보기 버튼으로 전달된다. */}
        <div className="pointer-events-none relative z-10 flex flex-col gap-2">
          {partnerName && (
            <span
              className="inline-flex w-fit items-center gap-1 text-xs font-medium"
              style={{ color: partnerColor ?? undefined }}
            >
              <IconFolder className="size-3.5" />
              {partnerName}
            </span>
          )}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium">{title}</h3>
            <div className="flex shrink-0 items-center gap-1">
              <Badge variant={visibility === "PUBLIC" ? "secondary" : "outline"}>
                {visibility === "PUBLIC" ? "공개" : "비공개"}
              </Badge>
              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="빠른 작업"
                      aria-label="빠른 작업"
                      className="pointer-events-auto"
                    >
                      <IconDotsVertical />
                    </Button>
                  }
                />
                <PopoverContent className="pointer-events-auto w-44 gap-0.5 p-1.5">
                  <DeriveDialog
                    parentProjectId={projectId}
                    onDone={() => setMenuOpen(false)}
                    trigger={
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <IconPlus className="size-4" />
                        하위 프로젝트 추가
                      </button>
                    }
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await duplicateProject(projectId);
                        setMenuOpen(false);
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <IconCopy className="size-4" />
                    프로젝트 복제
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${location.origin}/partners/${partnerId}?project=${projectId}`);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <IconLink className="size-4" />
                    프로젝트 링크 복사
                  </button>
                  <DeleteDialog
                    projectId={projectId}
                    onDeleted={() => setMenuOpen(false)}
                    trigger={
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
                      >
                        <IconTrash className="size-4" />
                        삭제하기
                      </button>
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={statusLabel === "완료" ? "secondary" : "default"}>{statusLabel}</Badge>
            {overdue && <Badge variant="destructive">지연</Badge>}
          </div>

          {participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {participants.slice(0, 4).map((p) => (
                <span
                  key={p.userId}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <span className={p.userId === currentUserId ? "pointer-events-auto inline-flex" : "inline-flex"}>
                    <ParticipantPriorityDot
                      projectId={projectId}
                      userId={p.userId}
                      userName={p.userName}
                      level={p.level}
                      currentUserId={currentUserId}
                    />
                  </span>
                  {p.userName}
                  {p.isMaster && " · master"}
                </span>
              ))}
              {participants.length > 4 && (
                <span className="text-xs text-muted-foreground">+{participants.length - 4}</span>
              )}
            </div>
          )}

          {links.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link}
                  className="pointer-events-auto inline-flex max-w-full items-center gap-1 text-xs text-primary underline underline-offset-2"
                >
                  <IconLink className="size-3.5 shrink-0" />
                  <span className="truncate">{linkLabel(link)}</span>
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>코멘트 {commentCount}개</span>
            <span>
              생성 {formatShortDate(createdAt)}
              {dueDate && ` ~ 마감 ${formatShortDate(dueDate)}`}
            </span>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>프로젝트 상세</DialogTitle>
          </DialogHeader>
          {open && <ProjectDetail projectId={projectId} onDeleted={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
