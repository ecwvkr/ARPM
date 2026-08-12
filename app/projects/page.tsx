import Link from "next/link";
import { auth } from "@/auth";
import { listVisiblePartners } from "@/lib/partners";
import { listProjectsForPartners, isProjectUnread } from "@/lib/projects";
import { STATUS_LABEL, isOverdue, buildParticipantChips } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";
import { NewProjectDialog } from "@/app/partners/[partnerId]/new-project-dialog";
import { ProjectStatusGroupsView } from "@/app/partners/[partnerId]/project-status-groups";
import { ProjectCanvas } from "@/app/partners/[partnerId]/canvas-loader";
import { listSavedFilters } from "@/app/actions/filters";
import { ProjectFilters } from "./filters";
import { WidthContainer } from "@/components/width-container";
import { chipClass } from "@/lib/ui";

const VIEWS = [
  { key: undefined, label: "리스트 뷰" },
  { key: "status", label: "보드 뷰" },
  { key: "canvas", label: "워크플로우" },
] as const;

// 뷰 탭은 현재 필터(partnerId/status/mine/q)를 그대로 유지한 채 view만 바꾼다.
function viewHref(params: Record<string, string | string[] | undefined>, view?: string) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "view" && typeof value === "string") sp.set(key, value);
  }
  if (view) sp.set("view", view);
  const qs = sp.toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export default async function AllProjectsPage({ searchParams }: PageProps<"/projects">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const partnerId = typeof params.partnerId === "string" ? params.partnerId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const mineOnly = params.mine === "1";
  const q = typeof params.q === "string" ? params.q : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
  const isCanvas = view === "canvas";

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const partners = await listVisiblePartners(session.user.id, isSuperAdmin, false);
  const activePartner = partnerId ? partners.find((p) => p.id === partnerId) : undefined;

  // 캔버스 뷰는 자체 조회(서버 액션)를 쓰므로 목록·저장필터를 미리 가져오지 않는다.
  const [savedFilters, projects] = await Promise.all([
    isCanvas ? [] : listSavedFilters(),
    isCanvas
      ? []
      : listProjectsForPartners(partners, session.user.id, isSuperAdmin, {
          partnerId,
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
              ← 전체 파트너
            </Link>
            <h1 className="text-base font-bold">{activePartner ? `${activePartner.name} 프로젝트` : "전체 프로젝트"}</h1>
            {activePartner && (
              <Link
                href={viewHref({ ...params, partnerId: undefined }, view)}
                className="block text-xs text-muted-foreground underline underline-offset-2"
              >
                ← 전체 프로젝트 보기
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NewProjectDialog
              partners={partners.map((p) => ({ id: p.id, name: p.name }))}
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
              className={chipClass(view === v.key)}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {isCanvas ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                href={viewHref({ ...params, partnerId: undefined }, "canvas")}
                className={
                  activePartner
                    ? "text-muted-foreground underline underline-offset-2"
                    : "font-medium underline underline-offset-2"
                }
              >
                전체 뷰
              </Link>
              {partners.map((p) => (
                <Link
                  key={p.id}
                  href={viewHref({ ...params, partnerId: p.id }, "canvas")}
                  className={`flex items-center gap-1.5 ${
                    p.id === activePartner?.id
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
            <ProjectCanvas
              key={activePartner?.id ?? "all"}
              partnerId={activePartner?.id ?? null}
              color={activePartner?.color ?? null}
              className="h-[calc(100dvh-16rem)] min-h-[420px]"
            />
          </>
        ) : (
          <>
            <ProjectFilters
              partners={partners.map((p) => ({ id: p.id, name: p.name }))}
              savedFilters={savedFilters.map((f) => ({ id: f.id, name: f.name, query: f.query }))}
            />

            {view === "status" ? (
              <ProjectStatusGroupsView projects={projects} currentUserId={session.user.id} />
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">조건에 맞는 프로젝트가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    projectId={project.id}
                    partnerId={project.partnerId}
                    title={project.title}
                    statusLabel={STATUS_LABEL[project.status]}
                    visibility={project.visibility}
                    overdue={isOverdue(project.dueDate, project.status)}
                    createdAt={project.createdAt}
                    dueDate={project.dueDate}
                    participants={buildParticipantChips(project)}
                    commentCount={project._count.comments}
                    currentUserId={session.user.id}
                    partnerName={project.partnerName}
                    partnerColor={project.partnerColor}
                    links={project.links}
                    unread={isProjectUnread(project, session.user.id)}
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
