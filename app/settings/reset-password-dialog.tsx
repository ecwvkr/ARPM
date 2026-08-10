"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { resetUserPassword } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconKey } from "@tabler/icons-react";

export function ResetPasswordDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const action = resetUserPassword.bind(null, userId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && !isPending && !errorMessage) {
      submitted.current = false;
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, errorMessage]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon-xs" variant="outline" title="비밀번호 초기화" aria-label="비밀번호 초기화">
            <IconKey />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>비밀번호 초기화</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`reset-pw-${userId}`}>새 비밀번호</Label>
            <Input id={`reset-pw-${userId}`} name="newPassword" type="password" required minLength={8} />
          </div>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            초기화
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
