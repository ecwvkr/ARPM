"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  updateProjectStatus,
  completeProject,
  reopenProject,
  extendDueDate,
  duplicateProject,
  listMovableTargets,
  moveProject,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DeriveDialog } from "./project-derive-dialog";
import { IconDotsVertical, IconPlus, IconCopy, IconArrowsMove, IconCalendar } from "@tabler/icons-react";

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function ProjectDetailStatus({
  projectId,
  status,
  dueDate,
  parentId,
  canParticipantAct,
  canManage,
  isSuperAdmin,
  locked,
  onDone,
}: {
  projectId: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: Date | null;
  parentId: string | null;
  canParticipantAct: boolean;
  canManage: boolean;
  isSuperAdmin: boolean;
  locked: boolean;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {canParticipantAct && !locked && (
            <>
              <Button
                size="sm"
                variant={status === "TODO" ? "default" : "outline"}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateProjectStatus(projectId, "TODO");
                    onDone();
                  })
                }
              >
                진행전
              </Button>
              <Button
                size="sm"
                variant={status === "IN_PROGRESS" ? "default" : "outline"}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateProjectStatus(projectId, "IN_PROGRESS");
                    onDone();
                  })
                }
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
                  onDone();
                })
              }
            >
              완료 취소
            </Button>
          )}
        </div>

        {canManage && <MoreMenu projectId={projectId} parentId={parentId} onDone={onDone} />}
      </div>

      {canParticipantAct && <DueDateControl projectId={projectId} dueDate={dueDate} onDone={onDone} />}
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

// 하위 프로젝트 추가·복제·상위 변경 등 자주 쓰지 않는 조작은 더보기로 내려 상단을 정리한다.
function MoreMenu({
  projectId,
  parentId,
  onDone,
}: {
  projectId: string;
  parentId: string | null;
  onDone: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button size="icon-sm" variant="ghost" title="더보기" aria-label="더보기">
              <IconDotsVertical />
            </Button>
          }
        />
        <PopoverContent className="w-52 gap-0.5 p-1.5">
          <DeriveDialog
            parentProjectId={projectId}
            onDone={() => {
              setMenuOpen(false);
              onDone();
            }}
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
                onDone();
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
              setMenuOpen(false);
              setShowMove(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <IconArrowsMove className="size-4" />
            상위 프로젝트 변경
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={showMove} onOpenChange={setShowMove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>상위 프로젝트 변경</DialogTitle>
          </DialogHeader>
          <MoveForm
            projectId={projectId}
            currentParentId={parentId}
            onDone={() => {
              setShowMove(false);
              onDone();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MoveForm({
  projectId,
  currentParentId,
  onDone,
}: {
  projectId: string;
  currentParentId: string | null;
  onDone: () => void;
}) {
  const [targets, setTargets] = useState<{ id: string; title: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listMovableTargets(projectId).then(setTargets);
  }, [projectId]);

  if (!targets) return <p className="text-sm text-muted-foreground">불러오는 중...</p>;

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await moveProject(projectId, formData);
          onDone();
        })
      }
      className="flex items-center gap-2"
    >
      <select
        name="parentId"
        aria-label="부모 프로젝트"
        defaultValue={currentParentId ?? ""}
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
      >
        <option value="">(최상위)</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        이동
      </Button>
    </form>
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
