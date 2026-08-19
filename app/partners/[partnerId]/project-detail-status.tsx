"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateProjectStatus,
  completeProject,
  reopenProject,
  extendDueDate,
  updateCreatedDate,
  duplicateProject,
  listMovableTargets,
  moveProject,
  setMyPriority,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeriveDialog } from "./project-derive-dialog";
import { ProjectParentPicker } from "@/components/project-parent-picker";
import { PriorityDot } from "./project-priority-picker";
import { showToast } from "@/components/ui/global-toast";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/priority";
import { IconDotsVertical, IconPlus, IconCopy, IconArrowsMove, IconCalendar } from "@tabler/icons-react";

const PRIORITY_LEVELS = ["URGENT", "NORMAL", "HOLD"] as const;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function ProjectDetailStatus({
  projectId,
  status,
  dueDate,
  createdAt,
  parentId,
  canParticipantAct,
  canManage,
  isSuperAdmin,
  locked,
  myPriority,
  onDone,
}: {
  projectId: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  createdAt: Date;
  parentId: string | null;
  canParticipantAct: boolean;
  canManage: boolean;
  isSuperAdmin: boolean;
  locked: boolean;
  myPriority: string;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<"TODO" | "IN_PROGRESS" | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {canParticipantAct && !locked && (
            <>
              <Button
                size="sm"
                variant={status === "TODO" ? "default" : "outline"}
                disabled={isPending}
                onClick={() => status !== "TODO" && setPendingStatus("TODO")}
              >
                진행전
              </Button>
              <Button
                size="sm"
                variant={status === "IN_PROGRESS" ? "default" : "outline"}
                disabled={isPending}
                onClick={() => status !== "IN_PROGRESS" && setPendingStatus("IN_PROGRESS")}
              >
                진행중
              </Button>
              <CompleteConfirmDialog projectId={projectId} onDone={onDone} />
            </>
          )}
          {locked && (canManage || isSuperAdmin) && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await reopenProject(projectId);
                  showToast("완료가 취소되었습니다");
                  onDone();
                })
              }
            >
              완료 취소
            </Button>
          )}
        </div>
      </div>

      {/* 참여자 칩에 붙어 있던 우선순위 설정을 상태 아래 별도 그룹으로 분리했다(프로젝트 13).
          칩 옆 색상 점 '표기'는 참여자 섹션에 그대로 남아 있다. */}
      {canParticipantAct && !locked && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">나의 긴급도 설정하기</span>
          {PRIORITY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              disabled={isPending}
              aria-pressed={myPriority === level}
              onClick={() =>
                startTransition(async () => {
                  await setMyPriority(projectId, level);
                  onDone();
                })
              }
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                myPriority === level ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <PriorityDot level={level} />
              {PRIORITY_LABEL[level]}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canParticipantAct && <DueDateControl projectId={projectId} dueDate={dueDate} onDone={onDone} />}
        {canManage && <CreatedDateControl projectId={projectId} createdAt={createdAt} onDone={onDone} />}
      </div>

      {/* 상태 변경도 되돌리기 전에 다른 사람 화면에 즉시 반영되므로 한 번 확인한다(프로젝트 12). */}
      <Dialog open={!!pendingStatus} onOpenChange={(next) => !next && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>진행 상태 변경</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            진행 상태를 &apos;{pendingStatus ? STATUS_LABEL[pendingStatus] : ""}&apos;(으)로 변경하시겠습니까?
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)}>
              아니요
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                const target = pendingStatus;
                if (!target) return;
                startTransition(async () => {
                  await updateProjectStatus(projectId, target);
                  setPendingStatus(null);
                  showToast(`'${STATUS_LABEL[target]}'(으)로 변경되었습니다`);
                  onDone();
                });
              }}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 마감일 텍스트 자체가 트리거 — 별도 [연장] 버튼 없이 눌러서 바로 달력을 연다.
function DueDateControl({
  projectId,
  dueDate,
  onDone,
}: {
  projectId: string;
  dueDate: Date | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const action = extendDueDate.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-dashed underline-offset-4 hover:text-foreground"
          >
            <IconCalendar className="size-4" />
            {dueDate ? `마감일 ${formatDate(dueDate)}` : "마감일이 설정되지 않았습니다."}
          </button>
        }
      />
      <PopoverContent className="w-auto gap-2 p-3">
        <form action={formAction} onSubmit={() => { submitted.current = true; }} className="flex items-center gap-2">
          <Input
            name="dueDate"
            type="date"
            defaultValue={dueDate ? new Date(dueDate).toISOString().slice(0, 10) : undefined}
            className="w-auto"
            required
          />
          <Button type="submit" size="sm" disabled={isPending}>
            저장
          </Button>
        </form>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </PopoverContent>
    </Popover>
  );
}

// 생성일 텍스트도 마감일과 같은 방식 — 눌러서 바로 달력을 열어 수정한다(master 전용).
function CreatedDateControl({
  projectId,
  createdAt,
  onDone,
}: {
  projectId: string;
  createdAt: Date;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const action = updateCreatedDate.bind(null, projectId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground underline decoration-dashed underline-offset-4 hover:text-foreground"
          >
            <IconCalendar className="size-4" />
            생성일 {formatDate(createdAt)}
          </button>
        }
      />
      <PopoverContent className="w-auto gap-2 p-3">
        <form action={formAction} onSubmit={() => { submitted.current = true; }} className="flex items-center gap-2">
          <Input
            name="createdAt"
            type="date"
            defaultValue={new Date(createdAt).toISOString().slice(0, 10)}
            className="w-auto"
            required
          />
          <Button type="submit" size="sm" disabled={isPending}>
            저장
          </Button>
        </form>
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      </PopoverContent>
    </Popover>
  );
}


function CompleteConfirmDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline">완료</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>프로젝트 완료</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">완료 시 수정이 불가능합니다. 완료하시겠습니까?</p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            아니요
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await completeProject(projectId);
                setOpen(false);
                showToast("'완료'로 변경되었습니다");
                onDone();
              })
            }
          >
            네
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
