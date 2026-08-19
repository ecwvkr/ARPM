"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { toggleUserSuperAdmin, toggleUserActive, deleteUserAccount } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateAccountForm } from "./create-account-form";
import { EditUserDialog } from "./edit-user-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { IconPlus } from "@tabler/icons-react";

type AdminUser = { id: string; name: string; email: string; isSuperAdmin: boolean; isActive: boolean };

export function UserManagement({ users }: { users: AdminUser[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [query, users]);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·이메일로 검색"
          className="max-w-sm"
        />
        <CreateAccountDialog />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="space-y-1.5">
        {filtered.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 p-3 text-sm"
          >
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                {u.name}
                {u.isSuperAdmin && <Badge variant="secondary">총관리자</Badge>}
                {!u.isActive && <Badge variant="destructive">비활성</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <EditUserDialog userId={u.id} name={u.name} email={u.email} />
              <ResetPasswordDialog userId={u.id} />
              <Button
                size="xs"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => toggleUserSuperAdmin(u.id))}
              >
                {u.isSuperAdmin ? "총관리자 해제" : "총관리자 부여"}
              </Button>
              {u.isActive ? (
                <DeactivateConfirmDialog
                  userName={u.name}
                  disabled={isPending}
                  onConfirm={() => run(() => toggleUserActive(u.id))}
                />
              ) : (
                <>
                  <Button size="xs" variant="outline" disabled={isPending} onClick={() => run(() => toggleUserActive(u.id))}>
                    활성화
                  </Button>
                  {/* 삭제는 비활성 계정에만 노출한다 — 실수로 쓰는 사고를 한 단계 더 막는다. */}
                  <DeleteUserDialog userId={u.id} userName={u.name} />
                </>
              )}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">검색 결과가 없습니다.</p>
        )}
      </ul>
    </div>
  );
}

function CreateAccountDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="outline" title="계정 발급" aria-label="계정 발급">
            <IconPlus className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>계정 발급</DialogTitle>
        </DialogHeader>
        <CreateAccountForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const action = deleteUserAccount.bind(null, userId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="xs" variant="destructive">
            삭제
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>계정 영구 삭제</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {userName} 님의 계정을 영구 삭제합니다. 되돌릴 수 없습니다.
        </p>
        <form action={formAction} className="space-y-2">
          <Input name="confirm" placeholder="확인을 위해 '삭제'를 입력하세요." />
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
              영구 삭제
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateConfirmDialog({
  userName,
  disabled,
  onConfirm,
}: {
  userName: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="xs" variant="outline" disabled={disabled}>
            비활성화
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>계정 비활성화</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {userName} 님의 계정을 비활성화합니다. 비활성화되면 로그인할 수 없습니다. 계속하시겠습니까?
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            아니요
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            비활성화
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
