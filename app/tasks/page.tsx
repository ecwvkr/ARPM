import Link from "next/link";
import { auth } from "@/auth";
import { listVisiblePartners } from "@/lib/partners";
import { listGroupedTasksForUser, flattenGroupedTasks } from "@/lib/tasks";
import { listAllUsers } from "@/app/actions/users";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { TaskFilters } from "./filters";
import { TaskListView } from "./task-list-view";
import { TaskBoardView } from "./task-board-view";
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

  const params = await searchParams;
  const selectedPartnerIds = toArray(typeof params.partners === "string" ? params.partners : undefined);
  const q = typeof params.q === "string" ? params.q : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
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
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">태스크</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <div className="flex items-center gap-2 text-xs">
          <Link href={viewHref(params, undefined)} className={chipClass(!view)}>
            리스트 뷰
          </Link>
          <Link href={viewHref(params, "board")} className={chipClass(view === "board")}>
            보드 뷰
          </Link>
        </div>

        <TaskFilters
          partners={partners.map((p) => ({ id: p.id, name: p.name }))}
          users={users}
          currentUserId={session.user.id}
          selectedAuthorId={selectedAuthorId}
        />

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">조건에 맞는 태스크가 없습니다.</p>
        ) : view === "board" ? (
          <TaskBoardView partners={grouped} />
        ) : (
          <TaskListView rows={flattenGroupedTasks(grouped)} />
        )}
      </WidthContainer>
    </div>
  );
}
