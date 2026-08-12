"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { removeMember, softDeletePartner, togglePartnerHide, updatePartnerSettings } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InviteForm } from "./invite-form";
import { useSavedToast } from "@/components/ui/saved-toast";
import { IconDotsVertical, IconX, IconCheck } from "@tabler/icons-react";

// 파스텔 프리셋 6~8개 + '색상 없음'. 색상표 대신 한 번 탭으로 고르게 한다(P5).
const COLOR_PRESETS = [
  "#F2A8A8",
  "#F5C99B",
  "#F2E29B",
  "#B8E0B0",
  "#A8DADC",
  "#A8C6F0",
  "#C9B6E4",
  "#F0B8D9",
];

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
  const settingsAction = updatePartnerSettings.bind(null, partner.id);
  const [errorMessage, formAction, isSaving] = useActionState(settingsAction, undefined);
  const [color, setColor] = useState(partner.color);
  const submitted = useRef(false);
  const { toast, trigger: showSavedToast } = useSavedToast();

  useEffect(() => {
    if (submitted.current && !isSaving && !errorMessage) {
      submitted.current = false;
      showSavedToast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving, errorMessage]);

  return (
    <>
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
              <form
                action={formAction}
                onSubmit={() => {
                  submitted.current = true;
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-foreground">파트너 명</h4>
                  <Input key={partner.name} name="name" defaultValue={partner.name} required className="h-9" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-foreground">공개 범위</h4>
                  <select
                    name="visibility"
                    aria-label="공개 범위"
                    defaultValue={partner.visibility}
                    className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs"
                  >
                    <option value="PRIVATE">비공개</option>
                    <option value="PUBLIC">공개</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-foreground">파트너 색상</h4>
                  <input type="hidden" name="color" value={color ?? ""} />
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        aria-label={c}
                        aria-pressed={color === c}
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card outline-none aria-pressed:ring-2 aria-pressed:ring-foreground"
                      >
                        {color === c && <IconCheck className="size-4 text-foreground/70" />}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={!color}
                      onClick={() => setColor(null)}
                      className="rounded-full border border-dashed px-3 py-1.5 text-xs text-muted-foreground aria-pressed:border-foreground aria-pressed:text-foreground"
                    >
                      색상 없음
                    </button>
                  </div>
                </div>

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                <Button type="submit" size="sm" disabled={isSaving} className="w-full">
                  저장
                </Button>
              </form>
            )}

            <div className="space-y-1.5 border-t border-foreground/10 pt-4">
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
      {toast}
    </>
  );
}
