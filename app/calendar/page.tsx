import Link from "next/link";
import { auth } from "@/auth";
import { listAllTasksForUser } from "@/lib/tasks";
import { STATUS_LABEL, isOverdue } from "@/lib/priority";
import { NotificationBell } from "@/app/notification-bell";
import { LogoutButton } from "@/app/logout-button";
import { WidthContainer } from "@/components/width-container";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthGrid(year: number, month: number) {
  const startWeekday = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const params = await searchParams;
  const today = new Date();
  const year = Number(params.y) || today.getFullYear();
  const month = (Number(params.m) || today.getMonth() + 1) - 1;

  const prevDate = new Date(year, month - 1, 1);
  const nextDate = new Date(year, month + 1, 1);

  const tasks = await listAllTasksForUser(session.user.id, !!session.user.isSuperAdmin, {});
  const tasksByDate = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const key = dateKey(new Date(t.dueDate));
    tasksByDate.set(key, [...(tasksByDate.get(key) ?? []), t]);
  }

  const days = monthGrid(year, month);
  const todayKey = dateKey(today);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 shadow-sm">
        <h1 className="text-base font-medium">캘린더</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <LogoutButton />
        </div>
      </header>

      <WidthContainer mainClassName="space-y-4 px-6 py-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/calendar?y=${prevDate.getFullYear()}&m=${prevDate.getMonth() + 1}`}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            ← 이전달
          </Link>
          <h2 className="text-sm font-medium">
            {year}년 {month + 1}월
          </h2>
          <Link
            href={`/calendar?y=${nextDate.getFullYear()}&m=${nextDate.getMonth() + 1}`}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            다음달 →
          </Link>
        </div>

        <div className="rounded-4xl bg-card p-3 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10 sm:p-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs text-muted-foreground">
            {WEEKDAY.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === month;
              const dayTasks = tasksByDate.get(key) ?? [];
              const visible = dayTasks.slice(0, 3);
              const overflow = dayTasks.length - visible.length;

              return (
                <div
                  key={key}
                  className={`min-h-[84px] rounded-xl p-1 ${inMonth ? "" : "opacity-40"}`}
                >
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                      key === todayKey ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {visible.map((t) => (
                      <Link
                        key={t.id}
                        href={`/projects/${t.projectId}?task=${t.id}`}
                        style={t.projectColor ? { borderLeftColor: t.projectColor } : undefined}
                        className={`block truncate rounded-md px-1 py-0.5 text-xs ${
                          t.projectColor ? "border-l-2" : ""
                        } ${
                          isOverdue(t.dueDate, t.status)
                            ? "bg-destructive/15 text-destructive"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                        title={`${t.title} · ${t.projectName} · ${STATUS_LABEL[t.status]}`}
                      >
                        {t.title}
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <p className="px-1 text-xs text-muted-foreground">+{overflow}개 더보기</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </WidthContainer>
    </div>
  );
}
