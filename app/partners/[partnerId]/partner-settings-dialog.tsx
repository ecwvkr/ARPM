"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  removeMember,
  softDeletePartner,
  togglePartnerHide,
  transferPartnerOwner,
  updatePartnerSettings,
  checkPartnerName,
  listPartnerJoinRequests,
  respondToPartnerJoin,
} from "@/app/actions/partners";
import { listAllUsers } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InviteForm } from "./invite-form";
import { useSavedToast } from "@/components/ui/saved-toast";
import { IconDotsVertical, IconX, IconCheck, IconChevronDown } from "@tabler/icons-react";

// 파스텔 프리셋 + '색상 없음'. 색상표 대신 한 번 탭으로 고르게 한다(P5).
// 첫 줄 8개만 기본 노출하고 나머지는 '더보기'로 펼친다.
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

const MORE_COLOR_PRESETS = [
  "#E88B8B",
  "#EFAE72",
  "#E3CE6E",
  "#93CC88",
  "#7FC4C7",
  "#7FA8E0",
  "#AE93D6",
  "#E093C4",
  "#C9A227",
  "#8AA37B",
  "#6E8CA0",
  "#9C8AA6",
  "#B58C7A",
  "#7F8C8D",
  "#5D6D7E",
  "#4A4A4A",
];

type PartnerMember = { userId: string; role: "OWNER" | "MEMBER"; user: { id: string; name: string } };

type PartnerSettingsData = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  color: string | null;
  ownerId: string;
  members: PartnerMember[];
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
  // 저장된 색이 확장 팔레트에 있으면 처음부터 펼쳐 둬야 선택된 칩이 보인다.
  const [showMoreColors, setShowMoreColors] = useState(
    !!partner.color && MORE_COLOR_PRESETS.includes(partner.color),
  );
  const submitted = useRef(false);
  const { toast, trigger: showSavedToast } = useSavedToast();

  // 이름 중복 확인(파트너 1): 저장 전에 물어보고, 사용자가 '예'를 고르면 제안 이름으로 바꿔 저장한다.
  const formRef = useRef<HTMLFormElement>(null);
  const [dupPrompt, setDupPrompt] = useState<{ suggested: string } | null>(null);
  const bypassCheck = useRef(false);

  useEffect(() => {
    if (submitted.current && !isSaving && !errorMessage) {
      submitted.current = false;
      showSavedToast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving, errorMessage]);

  const owner = partner.members.find((m) => m.userId === partner.ownerId);
  const ownerName = owner?.user.name ?? "-";
  const otherMembers = partner.members.filter((m) => m.userId !== partner.ownerId);

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
                ref={formRef}
                action={formAction}
                onSubmit={(e) => {
                  // 중복 확인을 마치고 다시 제출된 경로 — 그대로 통과시키되 저장 토스트는 띄운다.
                  if (bypassCheck.current) {
                    bypassCheck.current = false;
                    submitted.current = true;
                    return;
                  }
                  submitted.current = false;
                  const form = e.currentTarget;
                  const nameValue = (new FormData(form).get("name") as string | null)?.trim() ?? "";
                  if (nameValue && nameValue !== partner.name) {
                    e.preventDefault();
                    startTransition(async () => {
                      const result = await checkPartnerName(nameValue, partner.id);
                      if (result.duplicate) setDupPrompt({ suggested: result.suggested });
                      else {
                        bypassCheck.current = true;
                        form.requestSubmit();
                      }
                    });
                    return;
                  }
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
                      <ColorSwatch key={c} color={c} selected={color === c} onSelect={setColor} />
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
                  {showMoreColors && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {MORE_COLOR_PRESETS.map((c) => (
                        <ColorSwatch key={c} color={c} selected={color === c} onSelect={setColor} />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowMoreColors((v) => !v)}
                    aria-expanded={showMoreColors}
                    aria-label={showMoreColors ? "색상 접기" : "색상 더보기"}
                    className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showMoreColors ? "접기" : "더보기"}
                    <IconChevronDown className={`size-3.5 transition-transform ${showMoreColors ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                <Button type="submit" size="sm" disabled={isSaving || isPending} className="w-full">
                  저장
                </Button>
              </form>
            )}

            <div className="space-y-2 border-t border-foreground/10 pt-4">
              <h4 className="text-sm font-bold text-foreground">
                멤버 <span className="font-normal text-muted-foreground">(참여인원: {partner.members.length}명)</span>
              </h4>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">관리자</span>
                <span className="rounded-full bg-muted px-2.5 py-1">{ownerName}</span>
                {isOwner && <OwnerChangeButton partnerId={partner.id} currentOwnerId={partner.ownerId} />}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="shrink-0 text-muted-foreground">참여멤버</span>
                {otherMembers.length === 0 ? (
                  <span className="text-muted-foreground">없음</span>
                ) : (
                  otherMembers.map((m) => (
                    <span key={m.userId} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      {m.user.name}
                      {isOwner && (
                        <RemoveMemberDialog partnerId={partner.id} userId={m.userId} userName={m.user.name} />
                      )}
                    </span>
                  ))
                )}
              </div>

              {isOwner && <JoinRequestList partnerId={partner.id} />}

              {isOwner && (
                <div className="pt-1">
                  <InviteForm partnerId={partner.id} excludeIds={partner.members.map((m) => m.userId)} />
                </div>
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
            {canDelete && <ArchivePartnerSection partnerId={partner.id} />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupPrompt} onOpenChange={(next) => !next && setDupPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>중복된 파트너 이름이 있습니다.</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &apos;{dupPrompt?.suggested}&apos; 형태로 만드시겠습니까?
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDupPrompt(null)}>
              아니요
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const form = formRef.current;
                const input = form?.elements.namedItem("name") as HTMLInputElement | null;
                if (form && input && dupPrompt) {
                  input.value = dupPrompt.suggested;
                  setDupPrompt(null);
                  bypassCheck.current = true;
                  form.requestSubmit();
                }
              }}
            >
              예
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {toast}
    </>
  );
}

function ColorSwatch({
  color,
  selected,
  onSelect,
}: {
  color: string;
  selected: boolean;
  onSelect: (c: string) => void;
}) {
  return (
    <button
      type="button"
      title={color}
      aria-label={color}
      aria-pressed={selected}
      onClick={() => onSelect(color)}
      style={{ backgroundColor: color }}
      className="flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card outline-none aria-pressed:ring-2 aria-pressed:ring-foreground"
    >
      {selected && <IconCheck className="size-4 text-foreground/70" />}
    </button>
  );
}

// '업무 참여하기' 신청 목록. 관리자만 보이며 여기서 바로 수락/거부한다.
function JoinRequestList({ partnerId }: { partnerId: string }) {
  const [requests, setRequests] = useState<{ userId: string; userName: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listPartnerJoinRequests(partnerId).then(setRequests);
  }, [partnerId]);

  if (!requests || requests.length === 0) return null;

  function respond(userId: string, accept: boolean) {
    startTransition(async () => {
      await respondToPartnerJoin(partnerId, userId, accept);
      setRequests((prev) => prev?.filter((r) => r.userId !== userId) ?? null);
    });
  }

  return (
    <div className="space-y-1.5 pt-1">
      <p className="text-xs text-muted-foreground">참여 신청 ({requests.length})</p>
      {requests.map((r) => (
        <div key={r.userId} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
          <span>{r.userName}</span>
          <span className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => respond(r.userId, true)}
              className="font-medium text-primary underline underline-offset-2"
            >
              수락
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => respond(r.userId, false)}
              className="text-muted-foreground underline underline-offset-2 hover:text-destructive"
            >
              거부
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function OwnerChangeButton({ partnerId, currentOwnerId }: { partnerId: string; currentOwnerId: string }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && !users) listAllUsers().then(setUsers);
  }, [open, users]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" className="text-muted-foreground underline underline-offset-2">
            변경하기
          </button>
        }
      />
      <PopoverContent className="w-44 gap-0.5 p-1.5" align="start">
        <p className="px-2 pt-1 text-xs text-muted-foreground">관리자 변경</p>
        {!users ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">불러오는 중...</p>
        ) : (
          users.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={isPending || u.id === currentOwnerId}
              onClick={() =>
                startTransition(async () => {
                  await transferPartnerOwner(partnerId, u.id);
                  setOpen(false);
                })
              }
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-40 ${
                u.id === currentOwnerId ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {u.name}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}

// 멤버 제외는 되돌리기 번거로운 조작이라 두 가지를 각각 확인받는다:
// ① 파트너에서 제외할지 ② 이미 참여 중인 프로젝트에서도 뺄지.
function RemoveMemberDialog({
  partnerId,
  userId,
  userName,
}: {
  partnerId: string;
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmPartner, setConfirmPartner] = useState(false);
  const [alsoProjects, setAlsoProjects] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setConfirmPartner(false);
    setAlsoProjects(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <button type="button" aria-label={`${userName} 제외`} className="text-muted-foreground/60 hover:text-destructive">
            <IconX className="size-3" />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userName} 멤버 제외</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmPartner} onCheckedChange={(v) => setConfirmPartner(v === true)} className="mt-0.5" />
            <span>멤버를 파트너업무에서 제외시키겠습니까?</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={alsoProjects} onCheckedChange={(v) => setAlsoProjects(v === true)} className="mt-0.5" />
            <span>기존 참여된 프로젝트 업무도 제외시키겠습니까?</span>
          </label>
          <p className="text-xs text-muted-foreground">
            master로 지정된 프로젝트는 담당자가 사라지므로 제외되지 않습니다.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
            취소하기
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!confirmPartner || isPending}
            onClick={() =>
              startTransition(async () => {
                await removeMember(partnerId, userId, alsoProjects);
                setOpen(false);
                reset();
              })
            }
          >
            제외하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 보관함 이동은 '보관함'을 직접 입력해야 실행된다(프로젝트 보관과 같은 방식).
function ArchivePartnerSection({ partnerId }: { partnerId: string }) {
  const action = softDeletePartner.bind(null, partnerId);
  const [errorMessage, formAction, isPending] = useActionState(action, undefined);

  return (
    <div className="space-y-1.5 border-t border-foreground/10 pt-4">
      <h4 className="text-sm font-bold text-destructive">보관함으로 이동</h4>
      <p className="text-xs text-muted-foreground">
        목록에서 사라지지만 데이터는 남아 있어 설정 &gt; 보관함에서 복구하거나 영구 삭제할 수 있습니다.
      </p>
      <form action={formAction} className="space-y-2">
        <Input name="confirm" placeholder="확인을 위해 '보관함'을 입력하세요." className="h-9" />
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        <Button type="submit" size="sm" variant="destructive" disabled={isPending}>
          보관함으로 이동
        </Button>
      </form>
    </div>
  );
}
