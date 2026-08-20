import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";
import { PartnerJoinButton } from "@/components/partner-join-button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/app/notification-bell";
import { PartnerSettingsDialog } from "./partner-settings-dialog";
import { AdminControls } from "./admin-controls";
import { listPartnerAuditLog } from "@/app/actions/audit";
import { ProjectList } from "./project-list";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectCanvas } from "./canvas-loader";
import { ProjectStatusGroups } from "./project-status-groups";
import { ProjectKanban } from "./project-kanban";
import { ProjectDeepLink } from "./project-deep-link";
import { RecentPartnerTracker } from "./recent-partner-tracker";
import { WidthContainer } from "@/components/width-container";
import { chipClass } from "@/lib/ui";

export default async function PartnerDetailPage({
  params,
  searchParams,
}: PageProps<"/partners/[partnerId]">) {
  const { partnerId } = await params;
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const { partner, isOwner, isMember, canView, canDiscover } = await getPartnerAccess(
    partnerId,
    session.user.id,
    !!session.user.isSuperAdmin,
  );

  // 비공개+노출 파트너는 카드에서 넘어올 수 있으므로 페이지 자체는 열되(canDiscover),
  // 내부 프로젝트는 참여 승인 뒤에만 보여준다(canView).
  if (!partner || !canDiscover) notFound();

  // 아직 참여하지 않은 사람에게는 '업무 참여하기'를 띄운다(이미 신청했으면 대기중 표시).
  const pendingRequest = isMember
    ? null
    : await prisma.partnerJoinRequest.findUnique({
        where: { partnerId_userId: { partnerId, userId: session.user.id } },
        select: { status: true },
      });

  // 숨김은 개인 설정으로 옮겨갔다(D2) — 여기서는 보관함(deletedAt) 여부만 다룬다.
  const hidden = partner.deletedAt !== null;
  const canViewAudit = isOwner || !!session.user.isSuperAdmin;
  const auditLog = canViewAudit ? await listPartnerAuditLog(partner.id) : [];
  const members = partner.members.map((m) => ({
    userId: m.userId,
    role: m.role,
    user: { id: m.user.id, name: m.user.name },
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {partner.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: partner.color }}
              />
            )}
            <h1 className="text-base font-bold">{partner.name}</h1>
            <Badge variant={partner.visibility === "PUBLIC" ? "secondary" : "outline"}>
              {partner.visibility === "PUBLIC" ? "공개" : "비공개"}
            </Badge>
            {hidden && <Badge variant="destructive">보관됨</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {!isMember && (
              <PartnerJoinButton
                partnerId={partner.id}
                isPublic={partner.visibility === "PUBLIC"}
                requested={pendingRequest?.status === "PENDING"}
              />
            )}
            {isMember && <NewProjectDialog partnerId={partner.id} currentUserId={session.user.id} />}
            <PartnerSettingsDialog
              partner={{ ...partner, members }}
              isOwner={isOwner}
              canDelete={(isOwner || !!session.user.isSuperAdmin) && !hidden}
            />
            {hidden && (isOwner || session.user.isSuperAdmin) && <AdminControls partnerId={partner.id} />}
            <NotificationBell />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-8 px-6 py-6">
        {!canView ? (
          <section className="space-y-2 rounded-4xl bg-card p-6 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
            <h2 className="text-sm font-bold">비공개 파트너입니다</h2>
            <p className="text-sm text-muted-foreground">
              {pendingRequest?.status === "PENDING"
                ? "참여 신청이 접수되었습니다. 관리자가 수락하면 프로젝트를 볼 수 있습니다."
                : "참여 요청 후 관리자가 수락하면 프로젝트를 볼 수 있습니다."}
            </p>
          </section>
        ) : (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Link href={`/partners/${partner.id}`} className={chipClass(!view)}>
              리스트 뷰
            </Link>
            <Link href={`/partners/${partner.id}?view=status`} className={chipClass(view === "status")}>
              보드 뷰
            </Link>
            <Link href={`/partners/${partner.id}?view=canvas`} className={chipClass(view === "canvas")}>
              워크플로우
            </Link>
          </div>
          {view === "status" ? (
            <ProjectStatusGroups
              partnerId={partner.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
          ) : view === "canvas" ? (
            <ProjectCanvas partnerId={partner.id} color={partner.color} />
          ) : view === "kanban" ? (
            <ProjectKanban
              partnerId={partner.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
            />
          ) : (
            <ProjectList
              partnerId={partner.id}
              userId={session.user.id}
              isSuperAdmin={!!session.user.isSuperAdmin}
              isPartnerMember={isMember}
            />
          )}
        </section>
        )}

        {canViewAudit && auditLog.length > 0 && (
          <details className="space-y-2 rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
            <summary className="cursor-pointer text-sm font-bold text-foreground">
            활동 로그
          </summary>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {auditLog.map((l) => (
                <li key={l.id}>
                  <span className="text-foreground">{l.actorName}</span> · {l.message} ·{" "}
                  {new Date(l.createdAt).toLocaleString("ko-KR")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </WidthContainer>

      <ProjectDeepLink />
      <RecentPartnerTracker id={partner.id} name={partner.name} />
    </div>
  );
}
