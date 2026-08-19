"use client";

import { useState, useTransition } from "react";
import { createTask, toggleTask, deleteTask } from "@/app/actions/tasks";
import { IconCircle, IconCircleCheckFilled, IconPlus, IconX } from "@tabler/icons-react";

type Task = { id: string; title: string; done: boolean; createdAt: Date; completedAt: Date | null };

// 구글 Tasks/애플 미리알림 스타일 체크리스트: 좌측 원을 눌러 체크, 완료 항목은
// 회색+취소선으로 바뀌며 목록 하단으로 내려간다.
export function ProjectDetailTasks({
  projectId,
  tasks,
  canEdit,
  onDone,
}: {
  projectId: string;
  tasks: Task[];
  canEdit: boolean;
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", trimmed);
      await createTask(projectId, formData);
      setTitle("");
      onDone();
    });
  }

  return (
    <div className="space-y-0.5">
      {sorted.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">등록된 항목이 없습니다.</p>
      )}
      {sorted.map((t) => (
        <div key={t.id} className="group flex items-center gap-2 rounded-md px-1 py-1">
          <button
            type="button"
            disabled={!canEdit || isPending}
            aria-label={t.done ? "완료 취소" : "완료 처리"}
            onClick={() =>
              startTransition(async () => {
                await toggleTask(t.id);
                onDone();
              })
            }
            className={`shrink-0 ${t.done ? "text-primary" : "text-muted-foreground"}`}
          >
            {t.done ? <IconCircleCheckFilled className="size-5" /> : <IconCircle className="size-5" />}
          </button>
          <span className={`min-w-0 flex-1 text-sm break-words ${t.done ? "text-muted-foreground line-through" : ""}`}>
            {t.title}
          </span>
          {canEdit && (
            <button
              type="button"
              aria-label="항목 삭제"
              onClick={() =>
                startTransition(async () => {
                  await deleteTask(t.id);
                  onDone();
                })
              }
              className="shrink-0 text-muted-foreground/60 opacity-0 hover:text-destructive group-hover:opacity-100"
            >
              <IconX className="size-4" />
            </button>
          )}
        </div>
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
                  handleAdd();
                } else if (e.key === "Escape") {
                  setTitle("");
                  setAdding(false);
                }
              }}
              placeholder="새 항목"
              disabled={isPending}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={handleAdd}
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
