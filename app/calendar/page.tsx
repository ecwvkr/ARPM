import { auth } from "@/auth";
import { listAllProjectsForUser, isProjectUnread } from "@/lib/projects";
import { buildParticipantChips } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const params = await searchParams;
  const today = new Date();
  const initialDate =
    typeof params.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.d)
      ? params.d
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const initialView = params.v === "week" ? "week" : params.v === "day" ? "day" : "month";

  const projects = await listAllProjectsForUser(userId, !!session.user.isSuperAdmin, {});
  // 일간 뷰가 프로젝트 카드를 그대로 쓰므로 카드에 필요한 값만 추려 넘긴다
  // (prisma 결과 전체를 클라이언트로 넘기면 쓰지도 않는 관계 데이터까지 직렬화된다).
  const calendarProjects = projects.map((t) => ({
    id: t.id,
    partnerId: t.partnerId,
    title: t.title,
    status: t.status,
    visibility: t.visibility,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    partnerName: t.partnerName,
    partnerColor: t.partnerColor,
    participants: buildParticipantChips(t),
    commentCount: t._count.comments,
    links: t.links,
    unread: isProjectUnread(t, userId),
  }));

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <h1 className="text-base font-bold">캘린더</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LogoutButton />
          </div>
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <CalendarView
          initialDate={initialDate}
          initialView={initialView}
          projects={calendarProjects}
          currentUserId={userId}
        />
      </WidthContainer>
    </div>
  );
}
