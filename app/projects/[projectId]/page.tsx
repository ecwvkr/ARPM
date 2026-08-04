import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProjectAccess } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/app/notification-bell";
import { VisibilityForm } from "./visibility-form";
import { InviteForm } from "./invite-form";
import { AdminControls } from "./admin-controls";
import { TaskList } from "./task-list";
import { NewTaskDialog } from "./new-task-dialog";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { project, isOwner, canView } = await getProjectAccess(
    projectId,
    session.user.id,
    !!session.user.isSuperAdmin,
  );

  if (!project || !canView) notFound();

  const hidden = project.isArchived || project.deletedAt !== null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b-[0.5px] px-6 py-4">
        <div className="space-y-1">
          <Link href="/" className="text-xs text-muted-foreground underline underline-offset-2">
            ← 전체 프로젝트
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-medium">{project.name}</h1>
            <Badge variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}>
              {project.visibility === "PUBLIC" ? "공개" : "비공개"}
            </Badge>
            {hidden && (
              <Badge variant="destructive">{project.deletedAt ? "삭제됨" : "숨김"}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">owner: {project.owner.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {session.user.isSuperAdmin && (
            <AdminControls projectId={project.id} isArchived={project.isArchived} />
          )}
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 space-y-8 px-6 py-6">
        {isOwner && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">공개 범위</h2>
            <VisibilityForm projectId={project.id} visibility={project.visibility} />
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-medium">멤버 ({project.members.length})</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {project.members.map((m) => (
              <li key={m.userId}>
                {m.user.name} · {m.role === "OWNER" ? "owner" : "member"}
              </li>
            ))}
          </ul>
          {isOwner && <InviteForm projectId={project.id} />}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">업무</h2>
            <NewTaskDialog projectId={project.id} />
          </div>
          <TaskList
            projectId={project.id}
            userId={session.user.id}
            isSuperAdmin={!!session.user.isSuperAdmin}
          />
        </section>
      </main>
    </div>
  );
}
