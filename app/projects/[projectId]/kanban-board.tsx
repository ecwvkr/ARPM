"use client";

import { useRouter } from "next/navigation";
import { updateTaskStatus, completeTask } from "@/app/actions/tasks";
import { STATUS_LABEL, isOverdue, toPriorityBadges } from "@/lib/priority";
import { TaskCard } from "./task-card";
import type { ProjectTaskSummary } from "./task-list";

const COLUMNS = [
  { status: "TODO" as const, label: STATUS_LABEL.TODO },
  { status: "IN_PROGRESS" as const, label: STATUS_LABEL.IN_PROGRESS },
  { status: "DONE" as const, label: STATUS_LABEL.DONE },
];

export function KanbanBoard({ tasks }: { tasks: ProjectTaskSummary[] }) {
  const router = useRouter();

  async function handleDrop(taskId: string, target: "TODO" | "IN_PROGRESS" | "DONE") {
    try {
      if (target === "DONE") await completeTask(taskId);
      else await updateTaskStatus(taskId, target);
      router.refresh();
    } catch {
      alert("상태를 변경할 수 없습니다. 권한을 확인하세요.");
    }
  }

  return (
    <div className="hidden gap-4 lg:grid lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) handleDrop(taskId, col.status);
            }}
            className="space-y-2 rounded-xl border-[0.5px] bg-muted/30 p-3"
          >
            <h3 className="text-sm font-medium">
              {col.label} ({colTasks.length})
            </h3>
            <div className="space-y-2">
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                >
                  <TaskCard
                    taskId={task.id}
                    title={task.title}
                    statusLabel={col.label}
                    visibility={task.visibility}
                    overdue={isOverdue(task.dueDate, task.status)}
                    masterName={task.master.name}
                    participantCount={task.participants.length}
                    commentCount={task._count.comments}
                    dueDate={task.dueDate}
                    priorities={toPriorityBadges(task.priorities)}
                    tags={task.tags}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
