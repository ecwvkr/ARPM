"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateUserInfo } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconPencil } from "@tabler/icons-react";

export function EditUserDialog({ userId, name, email }: { userId: string; name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const action = updateUserInfo.bind(null, userId);
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
          <Button size="icon-xs" variant="outline" title="정보 수정" aria-label="정보 수정">
            <IconPencil />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>사용자 정보 수정</DialogTitle>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={() => {
            submitted.current = true;
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor={`edit-name-${userId}`}>이름</Label>
            <Input id={`edit-name-${userId}`} name="name" defaultValue={name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`edit-email-${userId}`}>이메일 또는 아이디</Label>
            <Input id={`edit-email-${userId}`} name="email" defaultValue={email} required />
          </div>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            저장
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
