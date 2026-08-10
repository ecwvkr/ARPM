import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProjectAccess } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/app/notification-bell";
import { ProjectSettingsDialog } from "./project-settings-dialog";
import { AdminControls } from "./admin-controls";
import { listProjectAuditLog } from "@/app/actions/audit";
import { TaskList } from "./task-list";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskCanvas } from "./canvas-loader";
import { TaskStatusGroups } from "./task-status-groups";
import { TaskKanban } from "./task-kanban";
import { TaskDeepLink } from "./task-deep-link";
import { WidthContainer } from "@/components/width-container";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { project, isOwner, canView } = await getProjectAccess(
    projectId,
    session.user.id,
    !!session.user.isSuperAdmin,
  );

  if (!project || !canView) notFound();

  const hidden = project.isArchived || project.deletedAt !== null;
  const canViewAudit = isOwner || !!session.user.isSuperAdmin;
  const auditLog = canViewAudit ? await listProjectAuditLog(project.id) : [];
  const members = project.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    user: { id: m.user.id, name: m.user.name },
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {project.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
            )}
            <h1 className="text-base font-bold">{project.name}</h1>
            <span className="text-sm text-muted-foreground">owner: {project.owner.name}</span>
            <Badge variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}>
              {project.visibility === "PUBLIC" ? "공개" : "비공개"}
            </Badge>
            {hidden && (
              <Badge variant="destructive">{project.deletedAt ? "삭제됨" : "숨김"}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NewTaskDialog projectId={project.id} currentUserId={session.user.id} />
            <ProjectSettingsDialog project={{ ...project, members }} isOwner={isOwner} />
            {session.user.isSuperAdmin && (
              <AdminControls
                projectId={project.id}
                isArchived={project.isArchived}
                isDeleted={project.deletedAt !== null}
              />
            )}
            <NotificationBell />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-8 px-6 py-6">
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/projects/${project.id}`}
              className={
                !view
                  ? "rounded-full bg-foreground px-3 py-1 font-medium text-background"
                  : "rounded-full bg-muted px-3 py-1 text-muted-foreground"
              }
            >
              대시보드
            </Link>
            <Link
              href={`/projects/${project.id}?view=status`}
              className={
                view === "status"
                  ? "rounded-full bg-foreground px-3 py-1 font-medium text-background"
                  : "rounded-full bg-muted px-3 py-1 text-muted-foreground"
              }
            >
              상태그룹
            </Link>
          </div>
          {view === "status" ? (
            <TaskStatusGroups
              projectId={project.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
          ) : view === "canvas" ? (
            <TaskCanvas projectId={project.id} color={project.color} />
          ) : view === "kanban" ? (
            <TaskKanban
              projectId={project.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
          ) : (
            <TaskList
              projectId={project.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
          )}
        </section>

        {canViewAudit && auditLog.length > 0 && (
          <details className="space-y-2 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
            <summary className="cursor-pointer text-sm font-bold text-foreground">
            활동 로그
          </summary>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {auditLog.map((l) => (
                <li key={l.id}>
                  <span className="text-foreground">{l.actorName}</span> · {l.message} ·{" "}
                  {new Date(l.createdAt).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </WidthContainer>

      <TaskDeepLink />
    </div>
  );
}
