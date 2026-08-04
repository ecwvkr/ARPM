"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TaskDetail } from "./task-detail";

export function TaskCard({
  taskId,
  title,
  statusLabel,
  visibility,
  overdue,
  masterName,
  participantCount,
  commentCount,
  dueDate,
}: {
  taskId: string;
  title: string;
  statusLabel: string;
  visibility: "PUBLIC" | "PRIVATE";
  overdue: boolean;
  masterName: string;
  participantCount: number;
  commentCount: number;
  dueDate: Date | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col gap-2 rounded-xl border-[0.5px] bg-card p-4 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <Badge variant={visibility === "PUBLIC" ? "secondary" : "outline"}>
            {visibility === "PUBLIC" ? "공개" : "비공개"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={statusLabel === "종료" ? "secondary" : "default"}>{statusLabel}</Badge>
          {overdue && <Badge variant="destructive">지연</Badge>}
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>master: {masterName}</p>
          <p>
            참여자 {participantCount}명 · 코멘트 {commentCount}개
          </p>
          {dueDate && <p>기한 {new Date(dueDate).toLocaleDateString("ko-KR")}</p>}
        </div>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>업무 상세</SheetTitle>
          </SheetHeader>
          {open && <TaskDetail taskId={taskId} onDeleted={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
