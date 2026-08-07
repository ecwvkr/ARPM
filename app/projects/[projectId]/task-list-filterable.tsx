"use client";

import { useState } from "react";
import { STATUS_LABEL, STATUS_ORDER, isOverdue, buildParticipantChips } from "@/lib/priority";
import { TaskCard } from "./task-card";
import type { ProjectTaskSummary } from "./task-list";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export function TaskListFilterable({
  tasks,
  currentUserId,
}: {
  tasks: ProjectTaskSummary[];
  currentUserId: string;
}) {
  const [active, setActive] = useState<Set<string>>(new Set());

  function toggle(status: string) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const visible = active.size === 0 ? tasks : tasks.filter((t) => active.has(t.status));
  const sorted = [...visible].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={active.has(s)}
            onClick={() => toggle(s)}
            className={
              active.has(s)
                ? "rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                : "rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
            }
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">조건에 맞는 업무가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              taskId={task.id}
              projectId={task.projectId}
              title={task.title}
              statusLabel={STATUS_LABEL[task.status]}
              visibility={task.visibility}
              overdue={isOverdue(task.dueDate, task.status)}
              createdAt={task.createdAt}
              dueDate={task.dueDate}
              participants={buildParticipantChips(task)}
              commentCount={task._count.comments}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
