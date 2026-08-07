import { listTasksForProject } from "@/lib/tasks";
import { TaskListFilterable } from "./task-list-filterable";

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

  return <TaskListFilterable tasks={tasks} currentUserId={userId} />;
}

export type ProjectTaskSummary = Awaited<ReturnType<typeof listTasksForProject>>[number];
