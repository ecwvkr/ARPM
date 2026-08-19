"use client";

import { useState, useTransition } from "react";
import { createTask, toggleTask, deleteTask, updateTask } from "@/app/actions/tasks";
import { Avatar } from "@/components/ui/avatar-stack";
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
  onDone,
}: {
  projectId: string;
  tasks: Task[];
  canEdit: boolean;
  currentUserId: string;
  isMaster: boolean;
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

function TaskRow({
  task,
  canCheck,
  canEditContent,
  onDone,
}: {
  task: Task;
  canCheck: boolean;
  canEditContent: boolean;
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

      {/* 누가 만든 항목인지 칩으로 간단히 표기(프로젝트 8). */}
      <span
        title={task.createdBy.name}
        className="flex shrink-0 items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-0.5 text-xs text-muted-foreground"
      >
        <Avatar id={task.createdById} name={task.createdBy.name} size="xs" />
        {task.createdBy.name}
      </span>

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
