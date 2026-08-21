"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { fetchChatPartners, fetchUnreadChatCount } from "@/app/actions/chat";
import type { ChatPartner } from "@/lib/chat";
import { ChatPanel } from "./chat-panel";
import { IconMessageCircle } from "@tabler/icons-react";

const LAST_PARTNER_KEY = "arpm.chat.lastPartnerId";

export type UnreadChat = { total: number; byPartner: Record<string, number> };

// 파트너 목록은 패널을 처음 열 때만 읽는다. 버튼만 떠 있는 동안에는 요청이 나가지 않는다.
export function ChatLauncher({
  currentUserId,
  initialUnread,
}: {
  currentUserId: string;
  initialUnread: UnreadChat;
}) {
  const [open, setOpen] = useState(false);
  const [partners, setPartners] = useState<ChatPartner[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unread, setUnread] = useState<UnreadChat>(initialUnread);

  const refreshUnread = useCallback(() => {
    fetchUnreadChatCount()
      .then(setUnread)
      .catch(() => {
        // 뱃지가 잠깐 예전 값이어도 대화 자체에는 영향이 없다.
      });
  }, []);

  // 첫 값은 서버 렌더에서 받았으므로 타이머로 계속 확인하지 않는다. 사람이 실제로
  // 뱃지를 볼 수 있게 되는 순간 — 탭으로 돌아왔을 때 — 에만 다시 읽는다. 호출 수가
  // 시계가 아니라 사용에 비례하므로, 아무도 안 쓰는 동안에는 0이다.
  useEffect(() => {
    window.addEventListener("focus", refreshUnread);
    return () => window.removeEventListener("focus", refreshUnread);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open || partners) return;
    fetchChatPartners()
      .then((list) => {
        setPartners(list);
        const remembered = localStorage.getItem(LAST_PARTNER_KEY);
        setSelectedId(list.find((p) => p.id === remembered)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => setErrorMessage("파트너 목록을 불러올 수 없습니다."));
  }, [open, partners]);

  function selectPartner(id: string) {
    setSelectedId(id);
    localStorage.setItem(LAST_PARTNER_KEY, id);
  }

  // 패널이 그 파트너를 읽음 처리했을 때. 서버를 다시 부르지 않고 그만큼 뺀다.
  const clearPartnerUnread = useCallback((partnerId: string) => {
    setUnread((prev) => {
      const count = prev.byPartner[partnerId] ?? 0;
      if (count === 0) return prev;
      const byPartner = { ...prev.byPartner };
      delete byPartner[partnerId];
      return { total: Math.max(0, prev.total - count), byPartner };
    });
  }, []);

  const selected = partners?.find((p) => p.id === selectedId) ?? null;

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

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // 닫을 때 한 번 맞춰준다 — 보는 동안 다른 파트너에 쌓인 것도 반영된다.
          if (!next) refreshUnread();
        }}
      >
        <SheetContent
          side="bottom"
          // 기본 max-h-[85vh] + 자체 스크롤 대신, 높이를 고정하고 메시지 영역만 스크롤시킨다.
          // dvh를 쓰는 이유는 모바일에서 키보드가 올라올 때 100vh 기준이면 입력창이 가려지기 때문.
          className="data-[side=bottom]:flex data-[side=bottom]:h-[80dvh] data-[side=bottom]:max-h-none data-[side=bottom]:flex-col data-[side=bottom]:overflow-hidden sm:data-[side=bottom]:right-4 sm:data-[side=bottom]:bottom-4 sm:data-[side=bottom]:left-auto sm:data-[side=bottom]:h-[34rem] sm:data-[side=bottom]:w-96 sm:data-[side=bottom]:rounded-3xl"
        >
          <div className="shrink-0 border-b border-foreground/10 px-4 pt-4 pr-14 pb-3">
            <SheetTitle className="sr-only">채팅</SheetTitle>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            {!errorMessage && partners === null && (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            )}
            {partners?.length === 0 && (
              <p className="text-sm text-muted-foreground">참여 중인 파트너가 없습니다.</p>
            )}
            {partners && partners.length > 0 && (
              // 파트너 수가 많지 않고 목록 이상의 기능이 필요 없어 기본 select를 쓴다.
              // 안읽음 수는 select 안에 뱃지를 넣을 수 없으므로 이름 뒤에 숫자로 붙인다.
              <select
                value={selectedId ?? ""}
                onChange={(e) => selectPartner(e.target.value)}
                aria-label="대화할 파트너"
                className="w-full max-w-xs rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                style={{ color: selected?.color ?? undefined }}
              >
                {partners.map((p) => {
                  const count = unread.byPartner[p.id] ?? 0;
                  return (
                    <option key={p.id} value={p.id}>
                      {count > 0 ? `${p.name} (${count})` : p.name}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {selected && (
            <ChatPanel
              key={selected.id}
              partner={selected}
              currentUserId={currentUserId}
              onRead={clearPartnerUnread}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
