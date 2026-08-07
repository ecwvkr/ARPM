import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getProjectAccess } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/app/notification-bell";
import { VisibilityForm } from "./visibility-form";
import { InviteForm } from "./invite-form";
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
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

      <WidthContainer mainClassName="space-y-8 px-6 py-6">
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
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">업무</h2>
              <div className="flex gap-1 text-xs">
                <Link
                  href={`/projects/${project.id}`}
                  className={!view ? "font-medium underline underline-offset-2" : "text-muted-foreground underline underline-offset-2"}
                >
                  대시보드
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/projects/${project.id}?view=status`}
                  className={view === "status" ? "font-medium underline underline-offset-2" : "text-muted-foreground underline underline-offset-2"}
                >
                  상태그룹
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/projects/${project.id}?view=canvas`}
                  className={view === "canvas" ? "font-medium underline underline-offset-2" : "text-muted-foreground underline underline-offset-2"}
                >
                  캔버스
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/projects/${project.id}?view=kanban`}
                  className={view === "kanban" ? "font-medium underline underline-offset-2" : "text-muted-foreground underline underline-offset-2"}
                >
                  칸반
                </Link>
              </div>
            </div>
            <NewTaskDialog projectId={project.id} />
          </div>
          {view === "canvas" ? (
            <TaskCanvas projectId={project.id} />
          ) : view === "status" ? (
            <TaskStatusGroups
              projectId={project.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
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
            <summary className="cursor-pointer text-sm font-medium">활동 로그</summary>
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
