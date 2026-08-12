import { listProjectsForPartner } from "@/lib/projects";
import { KanbanBoard } from "./kanban-board";

export async function ProjectKanban({
  partnerId,
  userId,
  isSuperAdmin,
}: {
  partnerId: string;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const projects = await listProjectsForPartner(partnerId, userId, isSuperAdmin);

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>;
  }

  return (
    <>
      <p className="text-sm text-muted-foreground lg:hidden">
        칸반 뷰는 PC 화면(넓은 화면)에서만 사용할 수 있습니다.
      </p>
      <KanbanBoard projects={projects} currentUserId={userId} />
    </>
  );
}
