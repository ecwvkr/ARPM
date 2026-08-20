import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listVisiblePartnersWithUnread, type PartnerSort } from "@/lib/partners";
import { listAllProjectsForUser, isProjectUnread } from "@/lib/projects";
import { ensureDeadlineNotifications } from "@/lib/notifications";
import { isOverdue } from "@/lib/priority";
import { LogoutButton } from "./logout-button";
import { NewPartnerDialog } from "./new-partner-dialog";
import { NotificationBell } from "./notification-bell";
import { PartnerCard } from "./partner-card";
import { WidthContainer } from "@/components/width-container";
import { PartnerSortSelect } from "./partner-sort-select";
import { IconChevronRight } from "@tabler/icons-react";

type PartnerFilter = "all" | "joined";

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
  const sort: PartnerSort =
    params.sort === "name" || params.sort === "created" ? params.sort : "activity";
  const filter: PartnerFilter = params.filter === "joined" ? "joined" : "all";

  // ponytail: 서로 의존하지 않는 네 조회(알림 점검·파트너 목록·내 프로젝트·전체 프로젝트)를
  // 순차 대기 대신 한 번에 날려 왕복 시간을 줄인다.
  const [, allPartners, myProjects, allProjects] = await Promise.all([
    ensureDeadlineNotifications(userId),
    listVisiblePartnersWithUnread(userId, isSuperAdmin, sort),
    listAllProjectsForUser(userId, isSuperAdmin, { assigneeIds: [userId] }),
    listAllProjectsForUser(userId, isSuperAdmin, {}),
  ]);

  // 개인별 숨김(D2)·즐겨찾기는 같은 조회 결과에서 갈라낸다 — 별도 쿼리 없이 한 번에 온
  // 목록을 화면에서 두 묶음(안 숨김/숨김)으로 나누고, 각 묶음 안에서는 즐겨찾기를 맨 위로.
  const visibleAll = allPartners.filter((p) => (p.hiddenBy?.length ?? 0) === 0);

  // 내가 직접 참여 중인 파트너인지 — 카드 묶음(참여/미참여)과 '업무 참여하기' 노출 기준.
  // 총관리자는 모든 파트너를 관리할 수 있지만, 이 구분은 "실제로 참여 중인가"를 보여주는
  // 개인 화면 정리 용도라 소유·멤버 여부만 본다.
  const isJoined = (p: (typeof allPartners)[number]) =>
    p.ownerId === userId || p.members.some((m) => m.userId === userId);

  // 상단 요약 카드 4종.
  // 전체 파트너 = 나에게 노출된 카드 수 / 참여 파트너 = 그중 내가 참여 중인 수.
  const joinedPartnerCount = visibleAll.filter(isJoined).length;
  // 진행 중 프로젝트 = 내가 참여 중인 파트너의 '진행 전'+'진행 중' 프로젝트 총합.
  // 참여 프로젝트 = 그중 내가 master이거나 참여자인 것.
  const joinedPartnerIds = new Set(visibleAll.filter(isJoined).map((p) => p.id));
  const activeProjects = allProjects.filter(
    (t) => joinedPartnerIds.has(t.partnerId) && t.status !== "DONE",
  );
  const myActiveProjectCount = activeProjects.filter(
    (t) => t.masterId === userId || t.participants.some((p) => p.userId === userId),
  ).length;

  const byFilter = (p: (typeof allPartners)[number]) => {
    if (filter === "joined") return isJoined(p);
    return true;
  };
  const sortPinnedFirst = (list: typeof allPartners) => [
    ...list.filter((p) => (p.pinnedBy?.length ?? 0) > 0),
    ...list.filter((p) => (p.pinnedBy?.length ?? 0) === 0),
  ];
  const shown = sortPinnedFirst(visibleAll.filter(byFilter));
  // 참여 중인 파트너를 위로, 참여하지 않은 파트너는 아래 아코디언으로 접어 둔다.
  const partners = shown.filter(isJoined);
  const notJoinedPartners = shown.filter((p) => !isJoined(p));
  const hiddenPartners = sortPinnedFirst(allPartners.filter((p) => (p.hiddenBy?.length ?? 0) > 0 && byFilter(p)));

  function widgetHref(next: PartnerFilter) {
    const sp = new URLSearchParams();
    sp.set("sort", sort);
    if (next !== "all") sp.set("filter", next);
    return `/?${sp.toString()}`;
  }

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const dueSoon = myProjects
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
          {/* 다른 화면들처럼 생성 버튼은 최상단 바에 둔다. */}
          <div className="flex items-center gap-3">
            <NewPartnerDialog currentUserId={userId} />
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryCard label="전체 파트너" value={visibleAll.length} href={widgetHref("all")} active={filter === "all"} />
          <SummaryCard
            label="참여 파트너"
            value={joinedPartnerCount}
            href={widgetHref("joined")}
            active={filter === "joined"}
          />
          {/* 프로젝트 태그 둘은 파트너 필터가 아니라 전체 프로젝트 화면으로 넘겨주는 버튼이다. */}
          <SummaryCard label="진행 중 프로젝트" value={activeProjects.length} href="/projects?f=1&status=TODO,IN_PROGRESS" active={false} />
          <SummaryCard label="참여 프로젝트" value={myActiveProjectCount} href="/projects?status=TODO,IN_PROGRESS" active={false} />
        </div>

        {dueSoon.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">오늘/이번주 마감</h2>
            <div className="space-y-2">
              {dueSoon.map((t) => (
                <Link
                  key={t.id}
                  href={`/partners/${t.partnerId}?project=${t.id}`}
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

        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">파트너</h2>
          <PartnerSortSelect />
        </div>

        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "참여 중인 파트너가 없습니다." : "조건에 맞는 파트너가 없습니다."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                currentUserId={userId}
                isSuperAdmin={isSuperAdmin}
                joined
                hasUnread={partner.projects.some((t) => isProjectUnread(t, userId))}
              />
            ))}
          </div>
        )}

        {notJoinedPartners.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground underline underline-offset-2">
              참여하지 않은 파트너 보기 ({notJoinedPartners.length})
              <IconChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {notJoinedPartners.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  currentUserId={userId}
                  isSuperAdmin={isSuperAdmin}
                  joined={false}
                  joinRequested={(partner.joinRequests?.length ?? 0) > 0}
                  hasUnread={false}
                />
              ))}
            </div>
          </details>
        )}

        {hiddenPartners.length > 0 && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground underline underline-offset-2">
              숨긴 파트너 보기 ({hiddenPartners.length})
              <IconChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {hiddenPartners.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  currentUserId={userId}
                  isSuperAdmin={isSuperAdmin}
                  joined={isJoined(partner)}
                  joinRequested={(partner.joinRequests?.length ?? 0) > 0}
                  hasUnread={partner.projects.some((t) => isProjectUnread(t, userId))}
                />
              ))}
            </div>
          </details>
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

function SummaryCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={`group flex items-center justify-between rounded-4xl p-4 shadow-md ring-1 transition-colors ${
        active
          ? "bg-foreground text-background ring-foreground"
          : "bg-card ring-foreground/5 hover:bg-muted dark:ring-foreground/10"
      }`}
    >
      <div className="text-left">
        <p className={active ? "text-xs text-background/70" : "text-xs text-muted-foreground"}>{label}</p>
        <p className="text-2xl font-black">{value}개</p>
      </div>
      <IconChevronRight
        className={`size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
          active ? "text-background" : "text-muted-foreground"
        }`}
      />
    </Link>
  );
}
