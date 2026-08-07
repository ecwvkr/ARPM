import { auth } from "@/auth";
import { listAllTasksForUser } from "@/lib/tasks";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";
import { CalendarView } from "./calendar-view";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const today = new Date();
  const year = Number(params.y) || today.getFullYear();
  const month = (Number(params.m) || today.getMonth() + 1) - 1;

  const tasks = await listAllTasksForUser(session.user.id, !!session.user.isSuperAdmin, {});

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
        <h1 className="text-base font-bold">캘린더</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <CalendarView initialYear={year} initialMonth={month} tasks={tasks} />
      </WidthContainer>
    </div>
  );
}
