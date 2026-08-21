"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar-stack";
import { createGroupRoom, openDirectRoom } from "@/app/actions/chat";
import { listAllUsers } from "@/app/actions/users";
import { chipClass } from "@/lib/ui";

// 새 대화 만들기. 1:1은 누구나, 단체방은 총관리자만 — 무분별한 방 증식을 막기 위한
// 제한이라 화면에서도 총관리자에게만 단체 탭을 보여준다.
export function NewRoomDialog({
  open,
  onOpenChange,
  currentUserId,
  isSuperAdmin,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  isSuperAdmin: boolean;
  onCreated: (roomId: string) => void;
}) {
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || users) return;
    listAllUsers()
      .then((list) => setUsers(list.filter((u) => u.id !== currentUserId)))
      .catch(() => setErrorMessage("사용자 목록을 불러올 수 없습니다."));
  }, [open, users, currentUserId]);

  function reset() {
    setSelected([]);
    setGroupName("");
    setErrorMessage(null);
  }

  function submit() {
    startTransition(async () => {
      try {
        const roomId =
          tab === "direct"
            ? await openDirectRoom(selected[0])
            : await createGroupRoom(groupName, selected);
        reset();
        onOpenChange(false);
        onCreated(roomId);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "채팅방을 만들 수 없습니다.");
      }
    });
  }

  const canSubmit =
    tab === "direct" ? selected.length === 1 : groupName.trim().length > 0 && selected.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 대화</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isSuperAdmin && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTab("direct");
                  setSelected([]);
                }}
                className={chipClass(tab === "direct")}
              >
                1:1 대화
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("group");
                  setSelected([]);
                }}
                className={chipClass(tab === "group")}
              >
                단체 채팅방
              </button>
            </div>
          )}

          {tab === "group" && (
            <div className="space-y-1.5">
              <Label htmlFor="group-name">채팅방 이름</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 2026 상반기 신메뉴"
                maxLength={40}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{tab === "direct" ? "대화 상대" : "참여자"}</Label>
            {users === null ? (
              <p className="text-sm text-muted-foreground">불러오는 중...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">대화할 수 있는 사용자가 없습니다.</p>
            ) : (
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {users.map((u) => {
                  const checked = selected.includes(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          setSelected((prev) =>
                            tab === "direct"
                              ? [u.id]
                              : prev.includes(u.id)
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id],
                          )
                        }
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                          checked ? "bg-secondary" : "hover:bg-muted"
                        }`}
                      >
                        <Avatar id={u.id} name={u.name} />
                        <span className="min-w-0 flex-1 truncate">{u.name}</span>
                        {checked && <span className="shrink-0 text-xs text-muted-foreground">선택됨</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="button" size="sm" disabled={!canSubmit || isPending} onClick={submit}>
              {tab === "direct" ? "대화 시작" : "채팅방 만들기"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
