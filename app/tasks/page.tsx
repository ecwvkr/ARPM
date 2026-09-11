import Link from "next/link";
import { auth } from "@/auth";
import { listVisiblePartners } from "@/lib/partners";
import { listGroupedTasksForUser, flattenGroupedTasks } from "@/lib/tasks";
import { listAllUsers } from "@/app/actions/users";
import { WidthContainer } from "@/components/width-container";
import { AppHeader } from "@/components/app-header";
import { RememberView } from "@/components/remember-view";
import { withRememberedView } from "@/lib/view-prefs";
import { TaskFilters } from "./filters";
import { TaskListView } from "./task-list-view";
import { TaskBoardView } from "./task-board-view";
import { NewTaskDialog } from "./new-task-dialog";
import { chipClass, toArray } from "@/lib/ui";

function viewHref(params: Record<string, string | string[] | undefined>, view?: string) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "view" && typeof value === "string") sp.set(key, value);
  }
  if (view) sp.set("view", view);
  const qs = sp.toString();
  return qs ? `/tasks?${qs}` : "/tasks";
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  // 주소에 뷰가 안 적혀 있으면 이 계정이 마지막에 보던 뷰로 되살린다.
  const params = await withRememberedView(session.user.id, "tasks", await searchParams);
  const selectedPartnerIds = toArray(typeof params.partners === "string" ? params.partners : undefined);
  const q = typeof params.q === "string" ? params.q : undefined;
  // 기본은 보드 뷰. 태스크는 어느 프로젝트 것인지가 중요해서 묶어 보는 편이 훑기 쉽다.
  const view = params.view === "list" ? "list" : "board";
  // author 파라미터가 없으면(순수 진입) 기본값은 "내 태스크"(=본인이 등록한 것만).
  // "all"이면 전체, 그 외에는 지정한 사용자가 등록한 것만.
  const rawAuthor = typeof params.author === "string" ? params.author : undefined;
  const selectedAuthorId = rawAuthor ?? session.user.id;
  const authorFilter = selectedAuthorId === "all" ? undefined : selectedAuthorId;

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const [partners, users, grouped] = await Promise.all([
    listVisiblePartners(session.user.id, isSuperAdmin, false),
    listAllUsers(),
    listGroupedTasksForUser(session.user.id, isSuperAdmin, {
      partnerIds: selectedPartnerIds,
      authorId: authorFilter,
      q,
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader title="태스크" />

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Link href={viewHref(params, undefined)} className={chipClass(view === "board")}>
              보드 뷰
            </Link>
            <Link href={viewHref(params, "list")} className={chipClass(view === "list")}>
              리스트 뷰
            </Link>
          </div>
          <NewTaskDialog partners={partners.map((p) => ({ id: p.id, name: p.name }))} />
        </div>

        <TaskFilters
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          users={users}
          currentUserId={session.user.id}
          selectedAuthorId={selectedAuthorId}
        />

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">조건에 맞는 태스크가 없습니다.</p>
        ) : view === "list" ? (
          <TaskListView rows={flattenGroupedTasks(grouped)} />
        ) : (
          <TaskBoardView partners={grouped} />
        )}
      </WidthContainer>
      <RememberView section="tasks" />
    </div>
  );
}
