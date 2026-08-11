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
  const initialDate =
    typeof params.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.d)
      ? params.d
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const initialView = params.v === "week" ? "week" : "month";

  const tasks = await listAllTasksForUser(session.user.id, !!session.user.isSuperAdmin, {});

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
        <CalendarView initialDate={initialDate} initialView={initialView} tasks={tasks} />
      </WidthContainer>
    </div>
  );
}
