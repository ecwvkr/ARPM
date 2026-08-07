"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { duplicateTask } from "@/app/actions/tasks";
import type { ParticipantChipData } from "@/lib/priority";
import { ParticipantPriorityDot } from "./task-priority-picker";
import { DeriveDialog } from "./task-derive-dialog";
import { DeleteDialog } from "./task-delete-dialog";
import { TaskDetail } from "./task-detail";
import { IconDotsVertical, IconPlus, IconCopy, IconLink, IconTrash } from "@tabler/icons-react";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function TaskCard({
  taskId,
  projectId,
  title,
  statusLabel,
  visibility,
  overdue,
  createdAt,
  dueDate,
  participants,
  commentCount,
  currentUserId,
  projectName,
}: {
  taskId: string;
  projectId: string;
  title: string;
  statusLabel: string;
  visibility: "PUBLIC" | "PRIVATE";
  overdue: boolean;
  createdAt: Date;
  dueDate: Date | null;
  participants: ParticipantChipData[];
  commentCount: number;
  currentUserId: string;
  projectName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="relative flex flex-col gap-2 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 z-0 rounded-4xl text-left"
          aria-label={title}
        />

        {/* pointer-events-none은 하위로 상속되므로, 실제 클릭이 필요한 요소만
            아래에서 각각 pointer-events-auto로 되돌린다. 그 외 영역은 클릭이
            투과되어 카드 전체를 덮은 상세보기 버튼으로 전달된다. */}
        <div className="pointer-events-none relative z-10 flex flex-col gap-2">
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
                    parentTaskId={taskId}
                    onDone={() => setMenuOpen(false)}
                    trigger={
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <IconPlus className="size-4" />
                        연계 업무 생성
                      </button>
                    }
                  />
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await duplicateTask(taskId);
                        setMenuOpen(false);
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <IconCopy className="size-4" />
                    업무 복제
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${location.origin}/projects/${projectId}?task=${taskId}`);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <IconLink className="size-4" />
                    업무 링크 복사
                  </button>
                  <DeleteDialog
                    taskId={taskId}
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
              {participants.map((p) => (
                <span
                  key={p.userId}
                  className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <span className={p.userId === currentUserId ? "pointer-events-auto inline-flex" : "inline-flex"}>
                    <ParticipantPriorityDot
                      taskId={taskId}
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
            </div>
          )}

          <div className="space-y-0.5 text-xs text-muted-foreground">
            {projectName && <p>{projectName}</p>}
            <p>코멘트 {commentCount}개</p>
            <p>생성일 {formatDate(createdAt)}</p>
            {dueDate && <p>마감일 {formatDate(dueDate)}</p>}
          </div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>업무 상세</SheetTitle>
          </SheetHeader>
          {open && <TaskDetail taskId={taskId} onDeleted={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
