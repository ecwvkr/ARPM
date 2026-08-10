import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listVisibleProjectsWithUnread } from "@/lib/projects";
import { listAllTasksForUser, isTaskUnread } from "@/lib/tasks";
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
  // 다른 페이지와 달리 여기만 가드가 없어, 세션이 비거나 토큰에 id가 없으면
  // session!.user.id 단언이 그대로 터져 로그인 리다이렉트 대신 500이 났다.
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const params = await searchParams;
  const isSuperAdmin = !!session.user.isSuperAdmin;
  const showHidden = isSuperAdmin && params.hidden === "1";

  // ponytail: 서로 의존하지 않는 세 조회(알림 점검·프로젝트 목록·내 업무)를 순차 대기
  // 대신 한 번에 날려 왕복 시간을 줄인다.
  // 프로덕션은 서버 컴포넌트 에러 메시지를 숨겨(React #441) 원인 추적이 불가능하므로,
  // 어느 조회가 왜 실패했는지만 화면에 남긴다. 내부 4인용 도구라 노출 위험은 없다.
  let projects: Awaited<ReturnType<typeof listVisibleProjectsWithUnread>>;
  let myTasks: Awaited<ReturnType<typeof listAllTasksForUser>>;
  try {
    [, projects, myTasks] = await Promise.all([
      ensureDeadlineNotifications(userId),
      listVisibleProjectsWithUnread(userId, isSuperAdmin, showHidden),
      listAllTasksForUser(userId, isSuperAdmin, { mineOnly: true }),
    ]);
  } catch (e) {
    return <DashboardLoadError error={e} userId={userId} isSuperAdmin={isSuperAdmin} />;
  }

  const ownedCount = projects.filter((p) => p.ownerId === userId).length;
  const inProgressCount = projects.filter((p) =>
    p.tasks.some((t) => t.status === "IN_PROGRESS"),
  ).length;

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
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
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <div className="flex items-center justify-end gap-3">
          {session?.user?.isSuperAdmin && (
            <Link
              href={showHidden ? "/" : "/?hidden=1"}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              {showHidden ? "숨김/삭제 프로젝트 숨기기" : "숨김/삭제 프로젝트 보기"}
            </Link>
          )}
          <NewProjectDialog currentUserId={userId} />
        </div>

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

        <h2 className="text-sm font-bold text-foreground">프로젝트</h2>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                currentUserId={userId}
                hasUnread={project.tasks.some((t) => isTaskUnread(t, userId))}
              />
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

// 대시보드 데이터 로딩이 실패했을 때, 프로덕션에서도 원인을 볼 수 있게 하는 진단 화면.
// 원인이 밝혀지면 이 컴포넌트와 try/catch는 제거한다.
function DashboardLoadError({
  error,
  userId,
  isSuperAdmin,
}: {
  error: unknown;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
      <div className="w-full max-w-2xl space-y-3 rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <h1 className="text-base font-bold">대시보드를 불러오지 못했습니다</h1>
        <p className="text-sm text-muted-foreground">
          아래 내용을 개발자에게 전달해 주세요. 다른 화면은 정상적으로 사용할 수 있습니다.
        </p>
        <div className="space-y-1 rounded-2xl bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            userId {userId} · superAdmin {String(isSuperAdmin)}
          </p>
          <p className="font-mono text-xs break-all text-destructive">
            {name}: {message}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/tasks" className="text-xs text-muted-foreground underline underline-offset-2">
            전체 업무로 가기
          </Link>
          <Link href="/settings" className="text-xs text-muted-foreground underline underline-offset-2">
            설정으로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-4xl bg-card p-4 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}개</p>
    </div>
  );
}
