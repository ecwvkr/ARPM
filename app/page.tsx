import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { ensureDeadlineNotifications } from "@/lib/notifications";
import { LogoutButton } from "./logout-button";
import { NewProjectDialog } from "./new-project-dialog";
import { NotificationBell } from "./notification-bell";
import { ProjectCard } from "./project-card";
import { WidthContainer } from "@/components/width-container";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d} ${WEEKDAY[date.getDay()]}`;
}

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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b-[0.5px] px-6 py-4">
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
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {formatDate(new Date())}
          </span>
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>
      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryCard label="전체 프로젝트" value={projects.length} />
          <SummaryCard label="나의 프로젝트" value={ownedCount} />
          <SummaryCard label="진행중인 프로젝트" value={inProgressCount} />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">프로젝트</h2>
          <Link
            href="/tasks"
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            전체 업무
          </Link>
        </div>

        <NewProjectDialog />

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {session?.user?.isSuperAdmin && (
          <Link
            href={showHidden ? "/" : "/?hidden=1"}
            className="block text-center text-sm text-muted-foreground underline underline-offset-2"
          >
            {showHidden ? "숨김/삭제 프로젝트 숨기기" : "숨김/삭제 프로젝트 보기"}
          </Link>
        )}
      </WidthContainer>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border-[0.5px] bg-card p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}개</p>
    </div>
  );
}
