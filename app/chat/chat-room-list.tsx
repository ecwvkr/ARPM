"use client";

import type { ChatRoomSummary } from "@/lib/chat";
import { toPlainText } from "@/lib/chat-markup";
import { IconFolder, IconUser, IconUsers } from "@tabler/icons-react";

function formatWhen(d: Date) {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

const KIND_ICON = {
  PARTNER: IconFolder,
  DIRECT: IconUser,
  GROUP: IconUsers,
} as const;

export function ChatRoomList({
  rooms,
  onOpen,
}: {
  rooms: ChatRoomSummary[];
  onOpen: (room: ChatRoomSummary) => void;
}) {
  if (rooms.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">참여 중인 채팅방이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-foreground/5">
      {rooms.map((room) => {
        const Icon = KIND_ICON[room.kind];
        return (
          <li key={room.id}>
            <button
              type="button"
              onClick={() => onOpen(room)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
            >
              {/* 파트너방은 파트너 색을 그대로 쓴다 — 목록에서 한눈에 구분되도록. */}
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: room.color ? `${room.color}20` : undefined,
                  color: room.color ?? undefined,
                }}
              >
                <Icon className={`size-4 ${room.color ? "" : "text-muted-foreground"}`} />
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span
                    className="min-w-0 truncate text-sm font-medium"
                    style={{ color: room.color ?? undefined }}
                  >
                    {room.name}
                  </span>
                  {room.kind !== "DIRECT" && (
                    <span className="shrink-0 text-xs text-muted-foreground">{room.memberCount}</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {room.lastMessagePreview ? toPlainText(room.lastMessagePreview) : "대화 없음"}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                {room.lastMessageAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(new Date(room.lastMessageAt))}
                  </span>
                )}
                {room.unread > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white">
                    {room.unread > 99 ? "99+" : room.unread}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
