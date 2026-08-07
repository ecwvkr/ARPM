import { listTasksForProject } from "@/lib/tasks";
import { KanbanBoard } from "./kanban-board";

export async function TaskKanban({
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
    <>
      <p className="text-sm text-muted-foreground lg:hidden">
        칸반 뷰는 PC 화면(넓은 화면)에서만 사용할 수 있습니다.
      </p>
      <KanbanBoard tasks={tasks} currentUserId={userId} />
    </>
  );
}
