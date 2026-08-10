"use client";

import { updateTaskStatus, completeTask } from "@/app/actions/tasks";
import { STATUS_LABEL, isOverdue, buildParticipantChips, isTaskUnread } from "@/lib/priority";
import { TaskCard } from "./task-card";
import type { ProjectTaskSummary } from "./task-list";

const COLUMNS = [
  { status: "TODO" as const, label: STATUS_LABEL.TODO },
  { status: "IN_PROGRESS" as const, label: STATUS_LABEL.IN_PROGRESS },
  { status: "DONE" as const, label: STATUS_LABEL.DONE },
];

export function KanbanBoard({
  tasks,
  currentUserId,
}: {
  tasks: ProjectTaskSummary[];
  currentUserId: string;
}) {
  // ponytail: updateTaskStatus/completeTask는 내부에서 revalidatePath를 호출하므로
  // Next가 현재 페이지를 이미 자동 갱신한다. router.refresh()는 중복 새로고침이라 제거.
  async function handleDrop(taskId: string, target: "TODO" | "IN_PROGRESS" | "DONE") {
    try {
      if (target === "DONE") await completeTask(taskId);
      else await updateTaskStatus(taskId, target);
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
                    projectId={task.projectId}
                    title={task.title}
                    statusLabel={col.label}
                    visibility={task.visibility}
                    overdue={isOverdue(task.dueDate, task.status)}
                    createdAt={task.createdAt}
                    dueDate={task.dueDate}
                    participants={buildParticipantChips(task)}
                    commentCount={task._count.comments}
                    currentUserId={currentUserId}
                    unread={isTaskUnread(task, currentUserId)}
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
