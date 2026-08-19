"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { PartnerSettingsDialog } from "@/app/partners/[partnerId]/partner-settings-dialog";
import { PartnerPinButton } from "@/app/partner-pin-button";
import { PartnerJoinButton } from "@/components/partner-join-button";

type PartnerCardData = {
  id: string;
  name: string;
  visibility: "PUBLIC" | "PRIVATE";
  deletedAt: Date | null;
  color: string | null;
  ownerId: string;
  members: { userId: string; role: "OWNER" | "MEMBER"; user: { id: string; name: string } }[];
  projects: { status: string }[];
  hiddenBy?: { userId: string }[];
  pinnedBy?: { userId: string }[];
};

export function PartnerCard({
  partner,
  currentUserId,
  isSuperAdmin = false,
  joined = true,
  joinRequested = false,
  hasUnread,
}: {
  partner: PartnerCardData;
  currentUserId: string;
  isSuperAdmin?: boolean;
  joined?: boolean;
  joinRequested?: boolean;
  hasUnread?: boolean;
}) {
  // 숨김은 개인 설정이라(D2) 카드에는 보관함(deletedAt) 여부만 표시한다.
  const hidden = partner.deletedAt !== null;
  const isOwner = partner.ownerId === currentUserId || isSuperAdmin;
  const todoCount = partner.projects.filter((t) => t.status === "TODO").length;
  const inProgressCount = partner.projects.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <div
      style={partner.color ? { backgroundColor: `color-mix(in oklch, ${partner.color} 14%, var(--card))` } : undefined}
      className="relative flex aspect-4/3 flex-col justify-between rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10"
    >
      <Link href={`/partners/${partner.id}`} className="absolute inset-0 z-0 rounded-4xl" aria-label={partner.name} />

      {hasUnread && (
        <span
          aria-label="읽지 않은 내용이 있습니다"
          title="읽지 않은 내용이 있습니다"
          className="absolute top-3 right-3 z-10 size-2.5 rounded-full bg-destructive ring-2 ring-card"
        />
      )}

      {/* 카드는 2~4열 그리드라 어느 폭에서도 좁다. 제목과 버튼을 한 줄에 두면 제목이
          글자당 한 줄씩 세로로 접히므로, 버튼 줄은 항상 제목 아래로 내린다. */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5">
        <h3 className="break-keep text-base font-bold">{partner.name}</h3>
        {/* 이 행 자체는 pointer-events-none이라 버튼/태그 사이 빈 공간은 클릭이 아래 배경
            링크로 투과돼 카드 전체가 파트너 페이지로 넘어간다. pointer-events:none은
            자식에게 상속되므로, 클릭을 받아야 하는 요소(고정·설정 버튼)와 클릭을 막아야
            하는 상태 태그는 각각 pointer-events-auto로 되돌려 준다. */}
        <div className="pointer-events-none flex flex-wrap items-center gap-0.5">
          <PartnerPinButton partnerId={partner.id} pinned={(partner.pinnedBy?.length ?? 0) > 0} />
          <Badge
            variant={partner.visibility === "PUBLIC" ? "secondary" : "outline"}
            className="pointer-events-auto rounded-full bg-background px-2"
          >
            {partner.visibility === "PUBLIC" ? "공개" : "비공개"}
          </Badge>
          <PartnerSettingsDialog
            partner={partner}
            isOwner={isOwner}
            canDelete={isOwner && !hidden}
            isHidden={(partner.hiddenBy?.length ?? 0) > 0}
            triggerClassName="pointer-events-auto relative z-10 bg-background"
          />
        </div>
      </div>

      {partner.members.length > 0 && (
        <div className="pointer-events-none relative z-10">
          <AvatarStack
            people={partner.members.map((m) => ({
              id: m.userId,
              name: m.role === "OWNER" ? `${m.user.name} (총관리자)` : m.user.name,
            }))}
          />
        </div>
      )}

      <div className="pointer-events-none relative z-10 space-y-0.5 text-sm text-muted-foreground">
        {/* 총관리자는 이미 모든 파트너에 접근할 수 있어 신청할 대상이 아니다. */}
        {!joined && !isSuperAdmin && (
          <div className="pointer-events-auto mb-1.5">
            <PartnerJoinButton partnerId={partner.id} requested={joinRequested} size="xs" />
          </div>
        )}
        {hidden && (
          <Badge variant="destructive" className="mb-1 rounded-full">
            보관됨
          </Badge>
        )}
        <p className="break-keep text-xs">
          프로젝트 {partner.projects.length}개 · 진행전 {todoCount}개 · 진행중 {inProgressCount}개
        </p>
      </div>
    </div>
  );
}
