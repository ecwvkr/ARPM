import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listVisiblePartnersWithUnread } from "@/lib/partners";
import { listAllProjectsForUser, isProjectUnread } from "@/lib/projects";
import { ensureDeadlineNotifications } from "@/lib/notifications";
import { isOverdue } from "@/lib/priority";
import { LogoutButton } from "./logout-button";
import { NewPartnerDialog } from "./new-partner-dialog";
import { NotificationBell } from "./notification-bell";
import { PartnerCard } from "./partner-card";
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
  // 숨김은 이제 계정별 개인 설정이라(D2) 누구나 자신이 숨긴 파트너를 다시 볼 수 있다.
  const showHiddenByMe = params.hidden === "1";

  // ponytail: 서로 의존하지 않는 세 조회(알림 점검·파트너 목록·내 프로젝트)를 순차 대기
  // 대신 한 번에 날려 왕복 시간을 줄인다.
  const [, partners, myProjects] = await Promise.all([
    ensureDeadlineNotifications(userId),
    listVisiblePartnersWithUnread(userId, isSuperAdmin, showHiddenByMe),
    listAllProjectsForUser(userId, isSuperAdmin, { mineOnly: true }),
  ]);

  const ownedCount = partners.filter((p) => p.ownerId === userId).length;
  const inProgressCount = partners.filter((p) =>
    p.projects.some((t) => t.status === "IN_PROGRESS"),
  ).length;

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
          <div className="flex items-center gap-3">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>
      <WidthContainer mainClassName="space-y-6 px-6 py-6">
        <div className="flex items-center justify-end gap-3">
          <Link
            href={showHiddenByMe ? "/" : "/?hidden=1"}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            {showHiddenByMe ? "숨긴 파트너 그만 보기" : "숨긴 파트너 보기"}
          </Link>
          <NewPartnerDialog currentUserId={userId} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SummaryCard label="전체 파트너" value={partners.length} />
          <SummaryCard label="나의 파트너" value={ownedCount} />
          <SummaryCard label="진행중인 파트너" value={inProgressCount} />
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

        <h2 className="text-sm font-bold text-foreground">파트너</h2>

        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 파트너가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                currentUserId={userId}
                hasUnread={partner.projects.some((t) => isProjectUnread(t, userId))}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-4xl bg-card p-4 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black">{value}개</p>
    </div>
  );
}
