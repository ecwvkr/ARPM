"use client";

import { useState, useTransition } from "react";
import { disconnectGoogleAccount } from "@/app/actions/google";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconBrandGoogle } from "@tabler/icons-react";

type Status = { googleEmail: string; connectedAt: Date; connectedByName: string } | null;

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR");
}

export function GoogleConnectionPanel({ status }: { status: Status }) {
  if (!status) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          연결하면 이 캘린더의 일정이 웹앱 캘린더 뷰에 함께 표시되고, 웹앱에서 등록한 업무는
          &quot;AR_PM 업무&quot;라는 별도 캘린더로 구글에 자동 생성되어 내보내집니다.
        </p>
        <Button
          render={
            <a href="/api/google/connect">
              <IconBrandGoogle className="size-4" />
              구글 캘린더 연결
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-3 text-sm">
        <Badge variant="secondary">연결됨</Badge>
        <span className="font-medium text-foreground">{status.googleEmail}</span>
        <span className="text-xs text-muted-foreground">
          {formatDate(status.connectedAt)} · {status.connectedByName}님이 연결
        </span>
      </div>
      <DisconnectConfirmDialog email={status.googleEmail} />
    </div>
  );
}

function DisconnectConfirmDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="destructive">연결 해제</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구글 캘린더 연결 해제</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {email} 연결을 해제합니다. 캘린더 뷰에서 구글 일정이 더 이상 보이지 않고, 웹앱 업무 내보내기도
          멈춥니다. 계속하시겠습니까?
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            아니요
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await disconnectGoogleAccount();
                setOpen(false);
              })
            }
          >
            연결 해제
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
