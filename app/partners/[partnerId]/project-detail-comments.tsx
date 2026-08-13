"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { addComment, updateComment, deleteComment } from "@/app/actions/projects";
import { useDetailSubmit } from "./use-detail-submit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconPencil, IconTrash } from "@tabler/icons-react";

// "@"를 치면 그 뒤로 공백 없이 이어지는 글자를 검색어로 본다. 문장 맨 앞이거나
// 공백 다음에 오는 "@"만 멘션 시작으로 인정해 이메일 등과 헷갈리지 않게 한다.
const MENTION_PATTERN = /(?:^|\s)@([^\s@]*)$/;

export function ProjectDetailComments({
  projectId,
  comments,
  commentVisibleCount,
  currentUserId,
  isSuperAdmin,
  canComment,
  mentionCandidates,
  onDone,
}: {
  projectId: string;
  comments: { id: string; body: string; authorId: string; author: { name: string } }[];
  commentVisibleCount: number;
  currentUserId: string;
  isSuperAdmin: boolean;
  canComment: boolean;
  mentionCandidates: { userId: string; userName: string }[];
  onDone: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-2">
      {!showAll && comments.length > commentVisibleCount && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          ... 이전 코멘트 {comments.length - commentVisibleCount}개 더보기
        </button>
      )}
      <ul className="space-y-2">
        {(showAll ? comments : comments.slice(-commentVisibleCount)).map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            canEdit={c.authorId === currentUserId || isSuperAdmin}
            onDone={onDone}
          />
        ))}
      </ul>
      {canComment && <CommentForm projectId={projectId} onDone={onDone} candidates={mentionCandidates} />}
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  onDone,
}: {
  comment: { id: string; body: string; author: { name: string } };
  canEdit: boolean;
  onDone: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { errorMessage, isPending, submit } = useDetailSubmit(updateComment.bind(null, comment.id));
  const [isDeleting, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="rounded-md bg-muted/50 p-2 text-sm">
        <form
          action={(formData) =>
            submit(formData, () => {
              setEditing(false);
              onDone();
            })
          }
          className="space-y-1.5"
        >
          <Textarea name="body" defaultValue={comment.body} rows={2} required />
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              저장
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-md bg-muted/50 p-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{comment.author.name}</p>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="코멘트 수정"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <IconPencil className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="코멘트 삭제"
              disabled={isDeleting}
              onClick={() =>
                startTransition(async () => {
                  await deleteComment(comment.id);
                  onDone();
                })
              }
              className="text-muted-foreground hover:text-destructive"
            >
              <IconTrash className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <p className="whitespace-pre-wrap">{comment.body}</p>
    </li>
  );
}

function CommentForm({
  projectId,
  onDone,
  candidates,
}: {
  projectId: string;
  onDone: () => void;
  candidates: { userId: string; userName: string }[];
}) {
  const { errorMessage, isPending, submit } = useDetailSubmit(addComment.bind(null, projectId));
  const [body, setBody] = useState("");
  const [notify, setNotify] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return candidates.filter((c) => c.userName.toLowerCase().includes(q)).slice(0, 5);
  }, [mentionQuery, candidates]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const cursor = e.target.selectionStart;
    const match = value.slice(0, cursor).match(MENTION_PATTERN);
    setMentionQuery(match ? match[1] : null);
  }

  // 멘션을 고르면 방금 치던 "@검색어"를 "@이름 "으로 바꿔 끼워넣고, 알림 대상에도 더한다.
  function pickMention(candidate: { userId: string; userName: string }) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? body.length;
    const before = body.slice(0, cursor).replace(MENTION_PATTERN, (matched) =>
      (matched.startsWith(" ") ? " " : "") + `@${candidate.userName} `,
    );
    setBody(before + body.slice(cursor));
    setMentionQuery(null);
    setNotify((prev) => (prev.includes(candidate.userId) ? prev : [...prev, candidate.userId]));
    requestAnimationFrame(() => textarea?.focus());
  }

  return (
    <form
      action={(formData) => {
        notify.forEach((userId) => formData.append("notify", userId));
        submit(formData, () => {
          setBody("");
          setNotify([]);
          onDone();
        });
      }}
      className="space-y-2"
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="body"
          value={body}
          onChange={handleChange}
          placeholder="코멘트를 입력하세요 (@로 멘션)"
          rows={2}
          required
        />
        {mentionQuery !== null && suggestions.length > 0 && (
          <div className="absolute bottom-full z-10 mb-1 w-48 space-y-0.5 rounded-md bg-popover p-1 text-sm shadow-lg ring-1 ring-foreground/10">
            {suggestions.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => pickMention(c)}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-muted"
              >
                @{c.userName}
              </button>
            ))}
          </div>
        )}
      </div>
      {notify.length > 0 && (
        <p className="text-xs text-muted-foreground">
          알림: {notify.map((id) => candidates.find((c) => c.userId === id)?.userName).join(", ")}
        </p>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        등록
      </Button>
    </form>
  );
}
