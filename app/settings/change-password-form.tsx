"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { changeMyPassword } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm() {
  const [errorMessage, formAction, isPending] = useActionState(changeMyPassword, undefined);
  const [success, setSuccess] = useState(false);
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setSuccess(true);
      formRef.current?.reset();
    }
  }, [isPending, errorMessage]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submitted.current = true;
        setSuccess(false);
      }}
      className="max-w-sm space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="current-password">현재 비밀번호</Label>
        <Input id="current-password" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">새 비밀번호</Label>
        <Input id="new-password" name="newPassword" type="password" required minLength={8} />
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      {success && <p className="text-sm text-muted-foreground">비밀번호가 변경되었습니다.</p>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}
