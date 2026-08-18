"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAccount } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showToast } from "@/components/ui/global-toast";

// onCreated 없이 쓰이는 곳이 없어 항상 전달된다고 가정 — 다이얼로그를 닫는 용도.
export function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [errorMessage, formAction, isPending] = useActionState(createUserAccount, undefined);
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      formRef.current?.reset();
      onCreated();
      // 다이얼로그가 바로 닫혀 폼 안의 성공 메시지는 보일 틈이 없다 — 대신 토스트로 알린다.
      showToast("계정이 생성되었습니다");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submitted.current = true;
      }}
      className="max-w-sm space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-account-name">이름</Label>
        <Input id="new-account-name" name="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-account-email">이메일 또는 아이디</Label>
        <Input id="new-account-email" name="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-account-password">비밀번호</Label>
        <Input id="new-account-password" name="password" type="password" required minLength={8} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="isSuperAdmin" className="size-4" />
        총관리자 권한 부여
      </label>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "생성 중..." : "계정 생성"}
      </Button>
    </form>
  );
}
