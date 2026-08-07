import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { listAllTasksForUser } from "@/lib/tasks";
import { ensureDeadlineNotifications } from "@/lib/notifications";
import { isOverdue } from "@/lib/priority";
import { LogoutButton } from "./logout-button";
import { NewProjectDialog } from "./new-project-dialog";
import { NotificationBell } from "./notification-bell";
import { ProjectCard } from "./project-card";
import { WidthContainer } from "@/components/width-container";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const session = await auth();
  const params = await searchParams;
  const showHidden = session?.user?.isSuperAdmin && params.hidden === "1";

  if (session?.user?.id) await ensureDeadlineNotifications(session.user.id);

  const projects = await listVisibleProjects(
    session!.user.id,
    !!session?.user?.isSuperAdmin,
    !!showHidden,
  );

  const ownedCount = projects.filter((p) => p.ownerId === session!.user.id).length;
  const inProgressCount = projects.filter((p) =>
    p.tasks.some((t) => t.status === "IN_PROGRESS"),
  ).length;

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const myTasks = await listAllTasksForUser(session!.user.id, !!session?.user?.isSuperAdmin, {
    mineOnly: true,
  });
  const dueSoon = myTasks
    .filter((t) => t.status !== "DONE" && t.dueDate && t.dueDate <= weekFromNow)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              AR
            </div>
            <div>
              <h1 className="text-base font-bold">AR_PM</h1>
              <p className="text-sm text-muted-foreground">{session?.user?.name}님</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session?.user?.isSuperAdmin && (
              <Link
                href={showHidden ? "/" : "/?hidden=1"}
                className="hidden text-xs text-muted-foreground underline underline-offset-2 sm:inline"
              >
                {showHidden ? "숨김/삭제 프로젝트 숨기기" : "숨김/삭제 프로젝트 보기"}
              </Link>
            )}
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryCard label="전체 프로젝트" value={projects.length} />
          <SummaryCard label="나의 프로젝트" value={ownedCount} />
          <SummaryCard label="진행중인 프로젝트" value={inProgressCount} />
        </div>

        {dueSoon.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">오늘/이번주 마감</h2>
            <div className="space-y-2">
              {dueSoon.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${t.projectId}?task=${t.id}`}
                  className="flex items-center justify-between rounded-4xl bg-card p-3 text-sm shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10"
                >
                  <span className="truncate">{t.title}</span>
                  <span
                    className={
                      isOverdue(t.dueDate, t.status)
                        ? "shrink-0 text-xs font-medium text-destructive"
                        : "shrink-0 text-xs text-muted-foreground"
                    }
                  >
                    {dueLabel(t.dueDate!, t.status)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">프로젝트</h2>
          <NewProjectDialog />
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} currentUserId={session!.user.id} />
            ))}
          </div>
        )}
      </WidthContainer>
    </div>
  );
}

function dueLabel(dueDate: Date, status: string) {
  if (isOverdue(dueDate, status)) return "지연";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  return `D-${diffDays}`;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-4xl bg-card p-4 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}개</p>
    </div>
  );
}
