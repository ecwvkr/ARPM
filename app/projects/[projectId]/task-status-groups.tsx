import { listTasksForProject, isTaskUnread } from "@/lib/tasks";
import { STATUS_LABEL, isOverdue, buildParticipantChips } from "@/lib/priority";
import { TaskCard } from "./task-card";

const GROUPS = [
  { status: "IN_PROGRESS" as const, label: STATUS_LABEL.IN_PROGRESS },
  { status: "TODO" as const, label: STATUS_LABEL.TODO },
  { status: "DONE" as const, label: STATUS_LABEL.DONE },
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
  return <TaskStatusGroupsView tasks={tasks} currentUserId={userId} />;
}

// 이미 업무를 가져온 화면(전체 업무)이 같은 쿼리를 다시 돌리지 않도록 표시 부분만 분리.
type GroupTask = Awaited<ReturnType<typeof listTasksForProject>>[number] & {
  projectName?: string;
  projectColor?: string | null;
};

export function TaskStatusGroupsView({
  tasks,
  currentUserId,
}: {
  tasks: GroupTask[];
  currentUserId: string;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 업무가 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      {GROUPS.map((group) => {
        const groupTasks = tasks.filter((t) => t.status === group.status);
        return (
          <details
            key={group.status}
            className="rounded-4xl bg-card shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10"
            open
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {group.label} ({groupTasks.length})
            </summary>
            {groupTasks.length > 0 && (
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    taskId={task.id}
                    projectId={task.projectId}
                    title={task.title}
                    statusLabel={group.label}
                    visibility={task.visibility}
                    overdue={isOverdue(task.dueDate, task.status)}
                    createdAt={task.createdAt}
                    dueDate={task.dueDate}
                    participants={buildParticipantChips(task)}
                    commentCount={task._count.comments}
                    currentUserId={currentUserId}
                    projectName={task.projectName}
                    projectColor={task.projectColor}
                    links={task.links}
                    unread={isTaskUnread(task, currentUserId)}
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
