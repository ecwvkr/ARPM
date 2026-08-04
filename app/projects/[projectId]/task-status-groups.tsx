import { listTasksForProject, isOverdue } from "@/lib/tasks";
import { TaskCard } from "./task-card";

const GROUPS = [
  { status: "IN_PROGRESS" as const, label: "진행중" },
  { status: "TODO" as const, label: "진행전" },
  { status: "DONE" as const, label: "종료" },
];

export async function TaskStatusGroups({
  projectId,
  userId,
  isSuperAdmin,
}: {
  projectId: string;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const tasks = await listTasksForProject(projectId, userId, isSuperAdmin);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 업무가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {GROUPS.map((group) => {
        const groupTasks = tasks.filter((t) => t.status === group.status);
        return (
          <details key={group.status} className="rounded-xl border-[0.5px]" open>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {group.label} ({groupTasks.length})
            </summary>
            {groupTasks.length > 0 && (
              <div className="grid grid-cols-1 gap-3 border-t-[0.5px] p-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    taskId={task.id}
                    title={task.title}
                    statusLabel={group.label}
                    visibility={task.visibility}
                    overdue={isOverdue(task.dueDate, task.status)}
                    masterName={task.master.name}
                    participantCount={task.participants.length}
                    commentCount={task._count.comments}
                    dueDate={task.dueDate}
                    priorities={task.priorities.map((p) => ({
                      userId: p.userId,
                      userName: p.user.name,
                      level: p.level,
                    }))}
                  />
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
