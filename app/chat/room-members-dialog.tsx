"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar-stack";
import { fetchRoomMembers, inviteToGroupRoom, removeFromGroupRoom } from "@/app/actions/chat";
import { listAllUsers } from "@/app/actions/users";
import { IconX } from "@tabler/icons-react";

type Member = { id: string; name: string };

// 참여자 보기. 단체방에서 총관리자만 초대·강퇴 버튼이 보인다.
// 파트너방 참여자는 파트너 멤버십을 따르므로 여기서 바꾸지 않는다.
export function RoomMembersDialog({
  open,
  onOpenChange,
  roomId,
  canManage,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  canManage: boolean;
  currentUserId: string;
}) {
  const [info, setInfo] = useState<{ kind: string; members: Member[] } | null>(null);
  const [candidates, setCandidates] = useState<Member[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(() => {
    fetchRoomMembers(roomId)
      .then((res) => setInfo({ kind: res.kind, members: res.members }))
      .catch(() => setErrorMessage("참여자를 불러올 수 없습니다."));
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !canManage || candidates) return;
    listAllUsers().then(setCandidates).catch(() => setCandidates([]));
  }, [open, canManage, candidates]);

  const memberIds = new Set(info?.members.map((m) => m.id) ?? []);
  const invitable = (candidates ?? []).filter((u) => !memberIds.has(u.id));

  function run(action: Promise<unknown>) {
    startTransition(async () => {
      try {
        await action;
        setConfirmingId(null);
        setErrorMessage(null);
        load();
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "처리할 수 없습니다.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>참여자 {info ? `(${info.members.length})` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {info === null ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {info.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <Avatar id={m.id} name={m.name} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.name}
                    {m.id === currentUserId && <span className="text-muted-foreground"> (나)</span>}
                  </span>
                  {canManage &&
                    m.id !== currentUserId &&
                    (confirmingId === m.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => run(removeFromGroupRoom(roomId, m.id))}
                        >
                          내보내기
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmingId(null)}
                        >
                          취소
                        </Button>
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`${m.name} 내보내기`}
                        onClick={() => setConfirmingId(m.id)}
                        className="text-muted-foreground"
                      >
                        <IconX />
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          )}

          {canManage && invitable.length > 0 && (
            <div className="space-y-1.5 border-t border-foreground/10 pt-3">
              <p className="text-xs text-muted-foreground">초대할 사람</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {invitable.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => run(inviteToGroupRoom(roomId, [u.id]))}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      <Avatar id={u.id} name={u.name} />
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">초대</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
