import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { listAllTasksForUser } from "@/lib/tasks";
import { STATUS_LABEL, isOverdue, toPriorityBadges } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { TaskCard } from "@/app/projects/[projectId]/task-card";
import { listSavedFilters } from "@/app/actions/filters";
import { TaskFilters } from "./filters";
import { WidthContainer } from "@/components/width-container";

export default async function AllTasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const mineOnly = params.mine === "1";
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const projects = await listVisibleProjects(session.user.id, isSuperAdmin, false);
  const savedFilters = await listSavedFilters();

  const tasks = await listAllTasksForUser(session.user.id, isSuperAdmin, {
    projectId,
    status: status as "TODO" | "IN_PROGRESS" | "DONE" | undefined,
    mineOnly,
    tag,
    q,
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
        <div className="space-y-1">
          <Link href="/" className="text-xs text-muted-foreground underline underline-offset-2">
            ← 전체 프로젝트
          </Link>
          <h1 className="text-base font-bold">전체 업무</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <TaskFilters
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          savedFilters={savedFilters.map((f) => ({ id: f.id, name: f.name, query: f.query }))}
        />

        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">조건에 맞는 업무가 없습니다.</p>
        ) : (
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
                priorities={toPriorityBadges(task.priorities)}
                projectName={task.projectName}
                tags={task.tags}
              />
            ))}
          </div>
        )}
      </WidthContainer>
    </div>
  );
}
