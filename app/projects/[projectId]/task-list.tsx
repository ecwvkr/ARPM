import { listTasksForProject, isOverdue } from "@/lib/tasks";
import { TaskCard } from "./task-card";

const STATUS_LABEL: Record<string, string> = {
  TODO: "진행전",
  IN_PROGRESS: "진행중",
  DONE: "종료",
};

export async function TaskList({
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          taskId={task.id}
          title={task.title}
          statusLabel={STATUS_LABEL[task.status]}
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
          tags={task.tags}
        />
      ))}
    </div>
  );
}

export type ProjectTaskSummary = Awaited<ReturnType<typeof listTasksForProject>>[number];
