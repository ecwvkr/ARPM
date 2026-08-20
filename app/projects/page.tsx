import Link from "next/link";
import { auth } from "@/auth";
import { listVisiblePartners } from "@/lib/partners";
import { listProjectsForPartners, isProjectUnread, type DueBucket, type ProjectSort } from "@/lib/projects";
import { isOverdue, buildParticipantChips, canJoinProject } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { ProjectCard } from "@/app/partners/[partnerId]/project-card";
import { NewProjectDialog } from "@/app/partners/[partnerId]/new-project-dialog";
import { ProjectStatusGroupsView } from "@/app/partners/[partnerId]/project-status-groups";
import { ProjectCanvas } from "@/app/partners/[partnerId]/canvas-loader";
import { listSavedFilters } from "@/app/actions/filters";
import { listAllUsers } from "@/app/actions/users";
import { ProjectFilters } from "./filters";
import { WidthContainer } from "@/components/width-container";
import { chipClass, toArray } from "@/lib/ui";

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
  // partnerId(단수)는 워크플로우 뷰의 파트너 전환 전용. 리스트·보드 뷰의 파트너 필터는
  // 다중 선택이라 별도 파라미터(partners, comma-join)를 쓴다.
  const partnerId = typeof params.partnerId === "string" ? params.partnerId : undefined;
  const selectedPartnerIds = toArray(typeof params.partners === "string" ? params.partners : undefined);
  const selectedStatuses = toArray(typeof params.status === "string" ? params.status : undefined) as (
    | "TODO"
    | "IN_PROGRESS"
    | "DONE"
  )[];
  // 요청 13: 필터를 한 번도 안 건드린 순수 진입(=f 없음, assignee도 없음)이면 "내 프로젝트"를
  // 기본값으로 켠다. f=1이 붙었다면 사용자가 의도적으로 담당자 필터를 전부 비운 것이므로
  // 빈 배열(전체 보기)을 그대로 존중한다.
  const touched = typeof params.f === "string";
  const rawAssignee = typeof params.assignee === "string" ? params.assignee : undefined;
  const selectedAssigneeIds =
    rawAssignee !== undefined ? toArray(rawAssignee) : touched ? [] : [session.user.id];
  const selectedDueBuckets = toArray(typeof params.due === "string" ? params.due : undefined) as DueBucket[];
  const q = typeof params.q === "string" ? params.q : undefined;
  const sort = typeof params.sort === "string" ? (params.sort as ProjectSort) : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;
  const isCanvas = view === "canvas";

  const isSuperAdmin = !!session.user.isSuperAdmin;
  const [partners, assignees] = await Promise.all([
    listVisiblePartners(session.user.id, isSuperAdmin, false),
    listAllUsers(),
  ]);
  // 카드의 '참여하기'는 그 파트너에 직접 참여 중인 사람에게만 뜬다(프로젝트 참여 자격 기준).
  const memberPartnerIds = new Set(
    partners
      .filter((p) => isSuperAdmin || p.ownerId === session.user.id || p.members.some((m) => m.userId === session.user.id))
      .map((p) => p.id),
  );
  const activePartner = partnerId ? partners.find((p) => p.id === partnerId) : undefined;
  const singleSelectedPartner =
    selectedPartnerIds.length === 1 ? partners.find((p) => p.id === selectedPartnerIds[0]) : undefined;

  // 캔버스 뷰는 자체 조회(서버 액션)를 쓰므로 목록·저장필터를 미리 가져오지 않는다.
  const [savedFilters, projects] = await Promise.all([
    isCanvas ? [] : listSavedFilters(),
    isCanvas
      ? []
      : listProjectsForPartners(partners, session.user.id, isSuperAdmin, {
          partnerIds: selectedPartnerIds,
          statuses: selectedStatuses,
          assigneeIds: selectedAssigneeIds,
          dueBuckets: selectedDueBuckets,
          q,
          sort,
        }),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-base font-bold">
              {(isCanvas ? activePartner : singleSelectedPartner)
                ? `${(isCanvas ? activePartner : singleSelectedPartner)!.name} 프로젝트`
                : "전체 프로젝트"}
            </h1>
            {(isCanvas ? activePartner : singleSelectedPartner) && (
              <Link
                href={viewHref({ ...params, partnerId: undefined, partners: undefined }, view)}
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
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
              <Link
                href={viewHref({ ...params, partnerId: undefined }, "canvas")}
                className={chipClass(!activePartner, "shrink-0")}
              >
                전체 뷰
              </Link>
              {partners.map((p) => (
                <Link
                  key={p.id}
                  href={viewHref({ ...params, partnerId: p.id }, "canvas")}
                  className={chipClass(p.id === activePartner?.id, "flex shrink-0 items-center gap-1.5")}
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
              assignees={assignees}
              currentUserId={session.user.id}
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
                    status={project.status}
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
                    canJoin={canJoinProject(project, session.user.id, memberPartnerIds.has(project.partnerId))}
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
