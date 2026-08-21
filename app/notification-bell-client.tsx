"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconBell, IconX } from "@tabler/icons-react";
import { listMyNotifications, markAllNotificationsRead, deleteNotification } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  href: string | null;
};

// 목록의 첫 로드는 서버 컴포넌트(notification-bell.tsx)가 넘겨준다. 여기서 다시
// 부르지 않으므로 페이지를 옮겨도 함수 호출이 늘지 않는다. 팝오버를 열 때만 새로 읽는다.
export function NotificationBellClient({ initial }: { initial: Notification[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setNotifications(await listMyNotifications());
    });
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="outline" size="icon" className="relative size-11" aria-label="알림">
            <IconBell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-sm font-medium">알림</span>
          {unreadCount > 0 && (
            <button
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  load();
                })
              }
            >
              모두 읽음
            </button>
          )}
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isPending && notifications.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">불러오는 중...</p>
          )}
          {!isPending && notifications.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">알림이 없습니다.</p>
          )}
          {notifications.map((n) => {
            const className = `block rounded-md px-2 py-1.5 pr-7 text-sm ${n.isRead ? "text-muted-foreground" : "bg-accent"}`;
            const body = (
              <>
                {n.message}
                <div className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString("ko-KR")}
                </div>
              </>
            );
            return (
              <div key={n.id} className="group relative">
                {n.href ? (
                  <Link href={n.href} className={`${className} hover:bg-muted`} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
                <button
                  type="button"
                  aria-label="알림 삭제"
                  title="알림 삭제"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteNotification(n.id);
                      load();
                    })
                  }
                  className="absolute top-1.5 right-1.5 text-muted-foreground/60 opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <IconX className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
