"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { fetchChatRooms, fetchUnreadChatCount } from "@/app/actions/chat";
import type { ChatRoomSummary } from "@/lib/chat";
import { ChatPanel } from "./chat-panel";
import { ChatRoomList } from "./chat-room-list";
import { NewRoomDialog } from "./new-room-dialog";
import { RoomMembersDialog } from "./room-members-dialog";
import { IconMessageCircle, IconChevronLeft, IconPlus, IconUsers } from "@tabler/icons-react";

export type UnreadChat = { total: number; byRoom: Record<string, number> };

export function ChatLauncher({
  currentUserId,
  isSuperAdmin,
  initialUnread,
}: {
  currentUserId: string;
  isSuperAdmin: boolean;
  initialUnread: UnreadChat;
}) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoomSummary[] | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoomSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unread, setUnread] = useState<UnreadChat>(initialUnread);
  const [newRoomOpen, setNewRoomOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const refreshUnread = useCallback(() => {
    fetchUnreadChatCount()
      .then(setUnread)
      .catch(() => {
        // 뱃지가 잠깐 예전 값이어도 대화 자체에는 영향이 없다.
      });
  }, []);

  const loadRooms = useCallback(
    (select?: string) =>
      fetchChatRooms()
        .then((list) => {
          setRooms(list);
          setErrorMessage(null);
          if (select) {
            const found = list.find((r) => r.id === select);
            if (found) setActiveRoom(found);
          }
        })
        .catch(() => setErrorMessage("채팅방 목록을 불러올 수 없습니다.")),
    [],
  );

  // 첫 값은 서버 렌더에서 받았으므로 타이머로 계속 확인하지 않는다. 사람이 실제로
  // 뱃지를 볼 수 있게 되는 순간 — 탭으로 돌아왔을 때 — 에만 다시 읽는다.
  useEffect(() => {
    window.addEventListener("focus", refreshUnread);
    return () => window.removeEventListener("focus", refreshUnread);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    loadRooms();
  }, [open, loadRooms]);

  // 방을 읽으면 뱃지에서 그만큼 뺀다(서버를 다시 부르지 않는다).
  const clearRoomUnread = useCallback((roomId: string) => {
    setUnread((prev) => {
      const count = prev.byRoom[roomId] ?? 0;
      if (count === 0) return prev;
      const byRoom = { ...prev.byRoom };
      delete byRoom[roomId];
      return { total: Math.max(0, prev.total - count), byRoom };
    });
    setRooms((prev) => prev?.map((r) => (r.id === roomId ? { ...r, unread: 0 } : r)) ?? prev);
  }, []);

  function closeSheet(next: boolean) {
    setOpen(next);
    if (!next) {
      // 다음에 열 때 목록 화면부터 보이도록 되돌린다.
      setActiveRoom(null);
      refreshUnread();
    }
  }

  const canManageRoom = activeRoom?.kind === "GROUP" && isSuperAdmin;

  return (
    <>
      {/* 하단 네비게이션(고정, 4rem)이 가리지 않도록 그 위에 띄운다. */}
      <Button
        type="button"
        size="icon"
        aria-label={unread.total > 0 ? `채팅 열기 (안 읽음 ${unread.total}개)` : "채팅 열기"}
        title="채팅"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-30 size-12 rounded-full shadow-lg"
      >
        <IconMessageCircle className="size-5" />
        {unread.total > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-white ring-2 ring-background">
            {unread.total > 99 ? "99+" : unread.total}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={closeSheet}>
        <SheetContent
          side="bottom"
          // 기본 max-h-[85vh] + 자체 스크롤 대신, 높이를 고정하고 안쪽만 스크롤시킨다.
          // dvh를 쓰는 이유는 모바일에서 키보드가 올라올 때 100vh 기준이면 입력창이 가려지기 때문.
          className="data-[side=bottom]:flex data-[side=bottom]:h-[80dvh] data-[side=bottom]:max-h-none data-[side=bottom]:flex-col data-[side=bottom]:overflow-hidden sm:data-[side=bottom]:right-4 sm:data-[side=bottom]:bottom-4 sm:data-[side=bottom]:left-auto sm:data-[side=bottom]:h-[34rem] sm:data-[side=bottom]:w-96 sm:data-[side=bottom]:rounded-3xl"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-foreground/10 px-4 pt-4 pr-14 pb-3">
            {activeRoom ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="채팅방 목록으로"
                  onClick={() => setActiveRoom(null)}
                  className="-ml-2"
                >
                  <IconChevronLeft className="size-4" />
                </Button>
                <SheetTitle
                  className="min-w-0 flex-1 truncate text-sm"
                  style={{ color: activeRoom.color ?? undefined }}
                >
                  {activeRoom.name}
                </SheetTitle>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="참여자 보기"
                  onClick={() => setMembersOpen(true)}
                >
                  <IconUsers className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <SheetTitle className="flex-1 text-sm">채팅</SheetTitle>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewRoomOpen(true)}>
                  <IconPlus className="size-4" />
                  새 대화
                </Button>
              </>
            )}
          </div>

          {errorMessage && <p className="px-4 py-3 text-sm text-destructive">{errorMessage}</p>}

          {activeRoom ? (
            <ChatPanel
              key={activeRoom.id}
              room={activeRoom}
              currentUserId={currentUserId}
              onRead={clearRoomUnread}
            />
          ) : rooms === null ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <ChatRoomList rooms={rooms} onOpen={setActiveRoom} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <NewRoomDialog
        open={newRoomOpen}
        onOpenChange={setNewRoomOpen}
        currentUserId={currentUserId}
        isSuperAdmin={isSuperAdmin}
        onCreated={(roomId) => loadRooms(roomId)}
      />

      {activeRoom && (
        <RoomMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          roomId={activeRoom.id}
          canManage={canManageRoom}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
