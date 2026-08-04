"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { listMyNotifications, markAllNotificationsRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setNotifications(await listMyNotifications());
    });
  };

  useEffect(() => {
    load();
  }, []);

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
          <Button variant="outline" size="icon" className="relative">
            <Bell className="size-4" />
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
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-md px-2 py-1.5 text-sm ${n.isRead ? "text-muted-foreground" : "bg-accent"}`}
            >
              {n.message}
              <div className="text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
