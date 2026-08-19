"use client";

import { useState, useTransition } from "react";
import { createTask, toggleTask, deleteTask, updateTask, transferTaskOwner } from "@/app/actions/tasks";
import { Avatar } from "@/components/ui/avatar-stack";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCircle, IconCircleCheckFilled, IconPlus, IconX, IconPencil } from "@tabler/icons-react";

type Task = {
  id: string;
  title: string;
  done: boolean;
  createdAt: Date;
  completedAt: Date | null;
  createdById: string;
  createdBy: { id: string; name: string };
};

// 구글 Tasks/애플 미리알림 스타일 체크리스트: 좌측 원을 눌러 체크, 완료 항목은
// 회색+취소선으로 바뀌며 목록 하단으로 내려간다.
export function ProjectDetailTasks({
  projectId,
  tasks,
  canEdit,
  currentUserId,
  isMaster,
  participants,
  onDone,
}: {
  projectId: string;
  tasks: Task[];
  canEdit: boolean;
  currentUserId: string;
  isMaster: boolean;
  participants: { userId: string; userName: string }[];
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // 엔터로 계속 이어서 쓸 수 있게, 저장 후에도 입력창을 열어둔 채 비우기만 한다(프로젝트 9).
  function handleAdd(keepOpen: boolean) {
    const trimmed = title.trim();
    if (!trimmed) {
      if (!keepOpen) setAdding(false);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      await createTask(projectId, formData);
      setTitle("");
      if (!keepOpen) setAdding(false);
      onDone();
    });
  }

  return (
    <div className="space-y-0.5">
      {sorted.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">등록된 항목이 없습니다.</p>
      )}
      {sorted.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          canCheck={canEdit}
          // 내용 수정·삭제는 작성자 본인 또는 master만(프로젝트 10·11).
          canEditContent={canEdit && (t.createdById === currentUserId || isMaster)}
          participants={participants}
          onDone={onDone}
        />
      ))}

      {canEdit &&
        (adding ? (
          <div className="flex items-center gap-2 px-1 py-1">
            <IconCircle className="size-5 shrink-0 text-muted-foreground/40" />
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!title.trim()) setAdding(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd(true);
                } else if (e.key === "Escape") {
                  setTitle("");
                  setAdding(false);
                }
              }}
              placeholder="새 항목 (엔터로 계속 추가)"
              disabled={isPending}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => handleAdd(false)}
              disabled={isPending || !title.trim()}
              className="shrink-0 text-sm font-medium text-primary disabled:opacity-40"
            >
              추가
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-1 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconPlus className="size-4" />
            항목 추가
          </button>
        ))}
    </div>
  );
}

// 작성자 칩을 눌러 다른 참여자에게 태스크를 넘긴다.
function OwnerChip({
  task,
  participants,
  onDone,
}: {
  task: Task;
  participants: { userId: string; userName: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const others = participants.filter((p) => p.userId !== task.createdById);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={`${task.createdBy.name} · 눌러서 담당 넘기기`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs text-muted-foreground hover:bg-muted/70"
          >
            <Avatar id={task.createdById} name={task.createdBy.name} size="xs" />
            {task.createdBy.name}
          </button>
        }
      />
      <PopoverContent className="w-44 gap-0.5 p-1.5" align="end">
        <p className="px-2 pt-1 text-xs text-muted-foreground">담당 넘기기</p>
        {others.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">넘길 참여자가 없습니다.</p>
        ) : (
          others.map((p) => (
            <button
              key={p.userId}
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await transferTaskOwner(task.id, p.userId);
                  setOpen(false);
                  onDone();
                })
              }
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              {p.userName}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

function TaskRow({
  task,
  canCheck,
  canEditContent,
  participants,
  onDone,
}: {
  task: Task;
  canCheck: boolean;
  canEditContent: boolean;
  participants: { userId: string; userName: string }[];
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [isPending, startTransition] = useTransition();

  function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === task.title) {
      setDraft(task.title);
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      await updateTask(task.id, formData);
      setEditing(false);
      onDone();
    });
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-1 py-1">
      <button
        type="button"
        disabled={!canCheck || isPending}
        aria-label={task.done ? "완료 취소" : "완료 처리"}
        onClick={() =>
          startTransition(async () => {
            await toggleTask(task.id);
            onDone();
          })
        }
        className={`shrink-0 ${task.done ? "text-primary" : "text-muted-foreground"}`}
      >
        {task.done ? <IconCircleCheckFilled className="size-5" /> : <IconCircle className="size-5" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          disabled={isPending}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      ) : (
        <span className={`min-w-0 flex-1 text-sm break-words ${task.done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </span>
      )}

      {/* 누가 만든 항목인지 칩으로 표기하고, 권한이 있으면 눌러서 다른 참여자에게 넘긴다. */}
      {canEditContent ? (
        <OwnerChip task={task} participants={participants} onDone={onDone} />
      ) : (
        <span
          title={task.createdBy.name}
          className="flex shrink-0 items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs text-muted-foreground"
        >
          <Avatar id={task.createdById} name={task.createdBy.name} size="xs" />
          {task.createdBy.name}
        </span>
      )}

      {canEditContent && !editing && (
        <>
          <button
            type="button"
            aria-label="항목 수정"
            onClick={() => setEditing(true)}
            className="shrink-0 text-muted-foreground/60 opacity-0 hover:text-foreground group-hover:opacity-100"
          >
            <IconPencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label="항목 삭제"
            onClick={() =>
              startTransition(async () => {
                await deleteTask(task.id);
                onDone();
              })
            }
            className="shrink-0 text-muted-foreground/60 opacity-0 hover:text-destructive group-hover:opacity-100"
          >
            <IconX className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
