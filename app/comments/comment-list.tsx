"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CommentFeedItem, CommentGroup } from "@/lib/comments";
import { Avatar } from "@/components/ui/avatar-stack";
import { linkifyWithMentions } from "@/components/linkify";

const MENTION_CHIP = "rounded-md bg-primary/10 px-1 font-medium text-primary";
const MENTION_CHIP_ME = "rounded-md bg-primary/25 px-1 font-medium text-primary";

const CARD =
  "w-full rounded-4xl bg-card p-4 text-left shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10";

// 코멘트를 누르면 그 프로젝트 상세가 열린다 — 프로젝트 카드를 누른 것과 같은 창이다.
// 주소에 ?project= 를 붙이면 ProjectDeepLink가 받아서 띄운다.
//
// groups가 있으면 묶어보기 뷰, 없으면 개별 뷰다. 두 뷰가 코멘트 한 건을 그리는 방식은
// 같아야 하므로 CommentBody/CommentMeta를 공유한다.
export function CommentList({
  groups,
  items,
  memberNames,
  myName,
  currentUserId,
}: {
  /** 묶어보기 뷰일 때만 채워진다. 개별 뷰에서는 null. */
  groups: CommentGroup[] | null;
  items: CommentFeedItem[];
  /** 멘션 칩으로 그릴 이름들(아는 이름이 아니면 그냥 글자로 둔다) */
  memberNames: string[];
  myName: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function open(projectId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", projectId);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">조건에 맞는 코멘트가 없습니다.</p>;
  }

  const body = (comment: CommentFeedItem) => (
    <>
      <p className="min-w-0 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
        {linkifyWithMentions(comment.body, memberNames, {
          // 카드 전체가 버튼이라 링크를 눌러도 상세 창이 열린다. 주소는 코멘트 안에서
          // 읽히면 되므로 밑줄만 두고 따로 걸지 않는다.
          linkClassName: "underline underline-offset-2 [overflow-wrap:anywhere]",
          chipClass: MENTION_CHIP,
          meChipClass: MENTION_CHIP_ME,
          myName,
        })}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Avatar id={comment.authorId} name={comment.authorName} size="xs" />
        <span className="shrink-0">{comment.authorName}</span>
        {comment.authorId === currentUserId && <span className="shrink-0">(나)</span>}
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate">{comment.createdAtLabel}</span>
      </div>
    </>
  );

  // 어느 파트너의 어느 프로젝트에서 오간 이야기인지. 두 뷰가 같은 줄을 쓴다.
  const header = (
    meta: {
      partnerName: string;
      partnerColor: string | null;
      projectTitle: string;
      projectDone: boolean;
    },
    count?: number,
  ) => (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {meta.partnerColor && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: meta.partnerColor }}
        />
      )}
      <span className="shrink-0">{meta.partnerName}</span>
      <span aria-hidden>·</span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{meta.projectTitle}</span>
      {count !== undefined && count > 1 && (
        <span className="shrink-0 tabular-nums">코멘트 {count}</span>
      )}
      {meta.projectDone && <span className="shrink-0">완료</span>}
    </div>
  );

  if (!groups) {
    return (
      <ul className="space-y-2">
        {items.map((comment) => (
          <li key={comment.id}>
            <button
              type="button"
              onClick={() => open(comment.projectId)}
              // 완료된 프로젝트의 코멘트는 흐리게 — 지금 챙길 것과 지난 것을 눈으로 가른다.
              className={`${CARD} ${comment.projectDone ? "opacity-55" : ""}`}
            >
              {header(comment)}
              <div className="mt-2">{body(comment)}</div>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {groups.map((group) => (
        <li key={group.projectId}>
          <button
            type="button"
            onClick={() => open(group.projectId)}
            className={`${CARD} ${group.projectDone ? "opacity-55" : ""}`}
          >
            {header(group, group.comments.length)}

            {/* 묶음 안은 오래된 것이 위, 새것이 아래 — 프로젝트 상세의 코멘트 순서와 같다. */}
            <div className="mt-2 divide-y divide-foreground/10">
              {group.comments.map((comment) => (
                <div key={comment.id} className="py-2 first:pt-0 last:pb-0">
                  {body(comment)}
                </div>
              ))}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
