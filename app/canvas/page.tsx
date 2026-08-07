import Link from "next/link";
import { auth } from "@/auth";
import { listVisibleProjects } from "@/lib/projects";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { TaskCanvas } from "@/app/projects/[projectId]/canvas-loader";
import { WidthContainer } from "@/components/width-container";

export default async function CanvasPage({ searchParams }: PageProps<"/canvas">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const projects = await listVisibleProjects(session.user.id, !!session.user.isSuperAdmin, false);
  const requestedId = typeof params.projectId === "string" ? params.projectId : undefined;
  const selected = projects.find((p) => p.id === requestedId) ?? projects[0];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
        <h1 className="text-base font-medium">캔버스</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-3 px-6 py-6">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/canvas?projectId=${p.id}`}
                  className={`flex items-center gap-1.5 ${
                    p.id === selected.id
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
              projectId={selected.id}
              color={selected.color}
              className="h-[calc(100dvh-11rem)] min-h-[420px]"
            />
          </>
        )}
      </WidthContainer>
    </div>
  );
}
