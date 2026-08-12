"use client";

import { useActionState, useState } from "react";
import { createPartner } from "@/app/actions/partners";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/user-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewPartnerDialog({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [errorMessage, formAction, isPending] = useActionState(
    createPartner,
    undefined,
  );
  const [members, setMembers] = useState<string[]>([]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="icon-sm" variant="outline" title="새 파트너" aria-label="새 파트너">
            <IconPlus />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 파트너</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            members.forEach((userId) => formData.append("userIds", userId));
            formAction(formData);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">파트너 명</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visibility">공개 범위</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue="PRIVATE"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            >
              <option value="PRIVATE">비공개</option>
              <option value="PUBLIC">공개</option>
            </select>
          </div>
          <UserPicker
            excludeIds={[currentUserId]}
            selected={members}
            onChange={setMembers}
            label="+ 참여자 설정"
          />
          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "생성 중..." : "만들기"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
