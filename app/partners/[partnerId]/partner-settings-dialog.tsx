"use client";

import { useTransition } from "react";
import { removeMember, softDeletePartner, togglePartnerHide } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PartnerNameForm } from "./partner-name-form";
import { VisibilityForm } from "./visibility-form";
import { PartnerColorForm } from "./partner-color-form";
import { InviteForm } from "./invite-form";
import { IconDotsVertical, IconX } from "@tabler/icons-react";

type PartnerSettingsData = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  color: string | null;
  members: { userId: string; role: "OWNER" | "MEMBER"; user: { id: string; name: string } }[];
};

export function PartnerSettingsDialog({
  partner,
  isOwner,
  canDelete = false,
  isHidden = false,
  triggerClassName = "",
}: {
  partner: PartnerSettingsData;
  isOwner: boolean;
  canDelete?: boolean;
  isHidden?: boolean;
  triggerClassName?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            title="파트너 설정"
            aria-label="파트너 설정"
            className={triggerClassName}
          >
            <IconDotsVertical />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{partner.name} 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">파트너 명</h4>
              <PartnerNameForm partnerId={partner.id} name={partner.name} />
            </div>
          )}
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">공개 범위</h4>
              <VisibilityForm partnerId={partner.id} visibility={partner.visibility} />
            </div>
          )}
          {isOwner && (
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-foreground">파트너 색상</h4>
              <PartnerColorForm partnerId={partner.id} currentColor={partner.color} />
            </div>
          )}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-foreground">멤버 ({partner.members.length})</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {partner.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2">
                  <span>
                    {m.user.name} · {m.role === "OWNER" ? "owner" : "member"}
                  </span>
                  {isOwner && m.role !== "OWNER" && (
                    <button
                      type="button"
                      aria-label={`${m.user.name} 제외`}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await removeMember(partner.id, m.userId);
                        })
                      }
                      className="text-muted-foreground/60 hover:text-destructive"
                    >
                      <IconX className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              <InviteForm partnerId={partner.id} excludeIds={partner.members.map((m) => m.userId)} />
            )}
          </div>
          <div className="space-y-1.5 border-t border-foreground/10 pt-4">
            <h4 className="text-sm font-bold text-foreground">내 대시보드에서 숨기기</h4>
            <p className="text-xs text-muted-foreground">
              나에게만 적용되며 다른 멤버의 화면에는 영향을 주지 않습니다.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await togglePartnerHide(partner.id);
                })
              }
            >
              {isHidden ? "숨김 해제" : "대시보드에서 숨기기"}
            </Button>
          </div>
          {canDelete && (
            <div className="space-y-1.5 border-t border-foreground/10 pt-4">
              <h4 className="text-sm font-bold text-destructive">보관함으로 이동</h4>
              <p className="text-xs text-muted-foreground">
                목록에서 사라지지만 데이터는 남아 있어 설정 &gt; 보관함에서 복구하거나 영구
                삭제할 수 있습니다.
              </p>
              <form
                action={softDeletePartner.bind(null, partner.id)}
                onSubmit={(e) => {
                  if (!confirm(`"${partner.name}" 파트너를 보관함으로 이동하시겠습니까?`)) e.preventDefault();
                }}
              >
                <Button type="submit" size="sm" variant="destructive">
                  보관함으로 이동
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
