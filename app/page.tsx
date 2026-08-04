import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { LogoutButton } from "./logout-button";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectCard } from "./project-card";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/">) {
  const session = await auth();
  const params = await searchParams;
  const showHidden = session?.user?.isSuperAdmin && params.hidden === "1";

  const projects = await listVisibleProjects(
    session!.user.id,
    !!session?.user?.isSuperAdmin,
    !!showHidden,
  );

  const ownedCount = projects.filter((p) => p.ownerId === session!.user.id).length;
  const memberCount = projects.filter((p) =>
    p.members.some((m) => m.userId === session!.user.id),
  ).length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b-[0.5px] px-6 py-4">
        <div>
          <h1 className="text-base font-medium">AR_PM</h1>
          <p className="text-sm text-muted-foreground">{session?.user?.name}님</p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryCard label="전체 프로젝트" value={projects.length} />
          <SummaryCard label="내가 만든 프로젝트" value={ownedCount} />
          <SummaryCard label="참여 중인 프로젝트" value={memberCount} />
        </div>

        {session?.user?.isSuperAdmin && (
          <Link
            href={showHidden ? "/" : "/?hidden=1"}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            {showHidden ? "숨김/삭제 프로젝트 숨기기" : "숨김/삭제 프로젝트 보기"}
          </Link>
        )}

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-[0.5px] bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
