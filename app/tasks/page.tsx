import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { listTasksForProjects, isTaskUnread } from "@/lib/tasks";
import { STATUS_LABEL, isOverdue, buildParticipantChips } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { TaskCard } from "@/app/projects/[projectId]/task-card";
import { NewTaskDialog } from "@/app/projects/[projectId]/new-task-dialog";
import { TaskStatusGroupsView } from "@/app/projects/[projectId]/task-status-groups";
import { TaskCanvas } from "@/app/projects/[projectId]/canvas-loader";
import { listSavedFilters } from "@/app/actions/filters";
import { TaskFilters } from "./filters";
import { WidthContainer } from "@/components/width-container";

const VIEWS = [
  { key: undefined, label: "대시보드" },
  { key: "status", label: "상태그룹" },
  { key: "canvas", label: "캔버스" },
] as const;

// 뷰 탭은 현재 필터(projectId/status/mine/q)를 그대로 유지한 채 view만 바꾼다.
function viewHref(params: Record<string, string | string[] | undefined>, view?: string) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "view" && typeof value === "string") sp.set(key, value);
  }
  if (view) sp.set("view", view);
  const qs = sp.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

export default async function AllTasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const mineOnly = params.mine === "1";
  const q = typeof params.q === "string" ? params.q : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
  const isCanvas = view === "canvas";

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const projects = await listVisibleProjects(session.user.id, isSuperAdmin, false);
  const activeProject = projectId ? projects.find((p) => p.id === projectId) : undefined;

  // 캔버스 뷰는 자체 조회(서버 액션)를 쓰므로 목록·저장필터를 미리 가져오지 않는다.
  const [savedFilters, tasks] = await Promise.all([
    isCanvas ? [] : listSavedFilters(),
    isCanvas
      ? []
      : listTasksForProjects(projects, session.user.id, isSuperAdmin, {
          projectId,
          status: status as "TODO" | "IN_PROGRESS" | "DONE" | undefined,
          mineOnly,
          q,
        }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="space-y-1">
            <Link href="/" className="text-xs text-muted-foreground underline underline-offset-2">
              ← 전체 프로젝트
            </Link>
            <h1 className="text-base font-bold">{activeProject ? `${activeProject.name} 업무` : "전체 업무"}</h1>
            {activeProject && (
              <Link
                href={viewHref({ ...params, projectId: undefined }, view)}
                className="block text-xs text-muted-foreground underline underline-offset-2"
              >
                ← 전체 업무 보기
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NewTaskDialog
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              currentUserId={session.user.id}
            />
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <div className="flex items-center gap-2 text-xs">
          {VIEWS.map((v) => (
            <Link
              key={v.label}
              href={viewHref(params, v.key)}
              className={
                view === v.key
                  ? "rounded-full bg-foreground px-3 py-1 font-medium text-background"
                  : "rounded-full bg-muted px-3 py-1 text-muted-foreground"
              }
            >
              {v.label}
            </Link>
          ))}
        </div>

        {isCanvas ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                href={viewHref({ ...params, projectId: undefined }, "canvas")}
                className={
                  activeProject
                    ? "text-muted-foreground underline underline-offset-2"
                    : "font-medium underline underline-offset-2"
                }
              >
                전체 뷰
              </Link>
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={viewHref({ ...params, projectId: p.id }, "canvas")}
                  className={`flex items-center gap-1.5 ${
                    p.id === activeProject?.id
                      ? "font-medium underline underline-offset-2"
                      : "text-muted-foreground underline underline-offset-2"
                  }`}
                >
                  {p.color && (
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                  )}
                  {p.name}
                </Link>
              ))}
            </div>
            <TaskCanvas
              key={activeProject?.id ?? "all"}
              projectId={activeProject?.id ?? null}
              color={activeProject?.color ?? null}
              className="h-[calc(100dvh-16rem)] min-h-[420px]"
            />
          </>
        ) : (
          <>
            <TaskFilters
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              savedFilters={savedFilters.map((f) => ({ id: f.id, name: f.name, query: f.query }))}
            />

            {view === "status" ? (
              <TaskStatusGroupsView tasks={tasks} currentUserId={session.user.id} />
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">조건에 맞는 업무가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    taskId={task.id}
                    projectId={task.projectId}
                    title={task.title}
                    statusLabel={STATUS_LABEL[task.status]}
                    visibility={task.visibility}
                    overdue={isOverdue(task.dueDate, task.status)}
                    createdAt={task.createdAt}
                    dueDate={task.dueDate}
                    participants={buildParticipantChips(task)}
                    commentCount={task._count.comments}
                    currentUserId={session.user.id}
                    projectName={task.projectName}
                    projectColor={task.projectColor}
                    unread={isTaskUnread(task, session.user.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </WidthContainer>
    </div>
  );
}
