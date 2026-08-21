"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar-stack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  markChatRead,
  sendChatMessage,
} from "@/app/actions/chat";
import type { ChatMessageView, ChatPartner } from "@/lib/chat";
import { MessageBody } from "./message-body";
import { IconSend, IconSearch, IconDotsVertical, IconX } from "@tabler/icons-react";

// 패널이 열려 있는 동안에만 짧게 폴링한다. 닫혀 있으면 요청이 아예 나가지 않으므로
// 아무도 대화를 보고 있지 않을 때의 비용이 0이다(무료 플랜의 병목은 호출 수와 CPU 시간).
const POLL_MS = 3000;
// 같은 사람이 이 시간 안에 이어 쓰면 한 덩어리로 묶어 이름과 아바타를 반복하지 않는다.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(d: Date) {
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// 서버 액션 결과는 직렬화를 거치며 Date가 문자열로 올 수 있어 항상 되살린다.
function reviveDates(list: ChatMessageView[]): ChatMessageView[] {
  return list.map((m) => ({
    ...m,
    createdAt: new Date(m.createdAt),
    editedAt: m.editedAt ? new Date(m.editedAt) : null,
  }));
}

function mergeById(prev: ChatMessageView[], incoming: ChatMessageView[]): ChatMessageView[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function ChatPanel({
  partner,
  currentUserId,
  onRead,
}: {
  partner: ChatPartner;
  currentUserId: string;
  onRead: (partnerId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, startSend] = useTransition();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const latestIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 파트너를 바꾸면 런처가 key로 이 컴포넌트를 다시 마운트하므로, 여기서 상태를
  // 되돌릴 필요 없이 처음 한 번만 읽으면 된다(효과 본문에서 동기 setState 금지).
  useEffect(() => {
    let cancelled = false;

    fetchChatMessages(partner.id)
      .then((res) => {
        if (cancelled) return;
        const list = reviveDates(res.messages);
        setMessages(list);
        setHasMore(res.hasMore);
        latestIdRef.current = list.at(-1)?.id ?? null;
        setErrorMessage(null);
        onRead(partner.id);
        return markChatRead(partner.id);
      })
      .catch((e) => {
        if (!cancelled) setErrorMessage(e instanceof Error ? e.message : "대화를 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partner.id, onRead]);

  // 첫 로드 뒤에는 맨 아래(최신)를 보여준다.
  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, partner.id, scrollToBottom]);

  // 폴링. 탭이 백그라운드면 멈춘다 — 밤새 열어둔 탭이 호출을 태우지 않게.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetchChatMessages(partner.id);
        const list = reviveDates(res.messages);
        const newest = list.at(-1)?.id ?? null;
        if (newest === latestIdRef.current) return;

        latestIdRef.current = newest;
        setMessages((prev) => mergeById(prev, list));
        // 보고 있는 동안 온 메시지는 읽은 것으로 처리한다.
        onRead(partner.id);
        await markChatRead(partner.id);
        scrollToBottom();
      } catch {
        // 일시적인 실패는 다음 주기에 다시 시도하면 되므로 화면을 건드리지 않는다.
      }
    };

    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [partner.id, scrollToBottom, onRead]);

  function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    fetchChatMessages(partner.id, oldest.createdAt.toISOString())
      .then((res) => {
        setMessages((prev) => mergeById(prev, reviveDates(res.messages)));
        setHasMore(res.hasMore);
      })
      .catch(() => setErrorMessage("이전 메시지를 불러올 수 없습니다."));
  }

  function send() {
    const text = draft.trim();
    if (!text || isSending) return;
    startSend(async () => {
      try {
        const created = await sendChatMessage(partner.id, text);
        const [revived] = reviveDates([created]);
        setMessages((prev) => mergeById(prev, [revived]));
        latestIdRef.current = revived.id;
        setDraft("");
        setErrorMessage(null);
        scrollToBottom();
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "메시지를 보낼 수 없습니다.");
      }
    });
  }

  function applyEdit(messageId: string, text: string) {
    editChatMessage(messageId, text)
      .then((updated) => {
        setMessages((prev) => mergeById(prev, reviveDates([updated])));
        setEditingId(null);
        setErrorMessage(null);
      })
      .catch((e) => setErrorMessage(e instanceof Error ? e.message : "메시지를 수정할 수 없습니다."));
  }

  function removeMessage(messageId: string) {
    deleteChatMessage(messageId)
      .then(() =>
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, deleted: true, body: "" } : m)),
        ),
      )
      .catch((e) => setErrorMessage(e instanceof Error ? e.message : "메시지를 삭제할 수 없습니다."));
  }

  // 검색은 이미 불러온 메시지만 훑는다. 파트너당 메시지가 수백 건 수준이라 서버로
  // 내릴 이유가 없고, 이렇게 하면 타이핑마다 요청이 나가지도 않는다.
  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? messages.filter((m) => !m.deleted && m.body.toLowerCase().includes(keyword))
    : messages;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 pb-2">
        {searchOpen ? (
          <>
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이 대화에서 검색"
                aria-label="대화 검색"
                className="h-auto py-1.5 pl-8 text-sm"
              />
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="검색 닫기"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
            >
              <IconX className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <IconSearch className="size-4" />
            검색
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {keyword && (
          <p className="pb-2 text-center text-xs text-muted-foreground">
            {visible.length > 0
              ? `불러온 대화에서 ${visible.length}건 찾았습니다`
              : "불러온 대화에서 찾지 못했습니다. '이전 메시지 더 보기'로 과거를 더 불러와 보세요."}
          </p>
        )}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button type="button" size="sm" variant="outline" onClick={loadOlder}>
              이전 메시지 더 보기
            </Button>
          </div>
        )}

        {loading && <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중...</p>}
        {!loading && messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            아직 대화가 없습니다. 첫 메시지를 남겨보세요.
          </p>
        )}

        {visible.map((message, i) => {
          const prev = visible[i - 1];
          const showDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
          const grouped =
            !showDay &&
            !!prev &&
            prev.author.id === message.author.id &&
            message.createdAt.getTime() - prev.createdAt.getTime() < GROUP_WINDOW_MS;
          const mine = message.author.id === currentUserId;

          return (
            <div key={message.id}>
              {showDay && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  {formatDay(message.createdAt)}
                </div>
              )}
              <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}>
                {/* 묶인 메시지는 아바타 자리만 비워 말풍선 시작점을 맞춘다. */}
                <div className="w-6 shrink-0">
                  {!grouped && <Avatar id={message.author.id} name={message.author.name} />}
                </div>
                <div className={`flex min-w-0 flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                  {!grouped && !mine && (
                    <span className="text-xs text-muted-foreground">{message.author.name}</span>
                  )}
                  {editingId === message.id ? (
                    <EditRow
                      initial={message.body}
                      onCancel={() => setEditingId(null)}
                      onSave={(text) => applyEdit(message.id, text)}
                    />
                  ) : (
                    <div className={`flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`max-w-[15rem] rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap sm:max-w-md ${
                          message.deleted
                            ? "bg-muted text-muted-foreground italic"
                            : mine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                        }`}
                      >
                        {message.deleted ? "삭제된 메시지입니다" : <MessageBody text={message.body} />}
                      </div>
                      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                        {formatTime(message.createdAt)}
                        {message.editedAt && !message.deleted && " (수정됨)"}
                      </span>
                      {/* 수정·삭제는 본인이 쓴 메시지에만 연다. 파트너 관리자의 삭제 권한은
                          서버에 열려 있지만 화면에는 아직 붙이지 않았다. */}
                      {mine && !message.deleted && (
                        <MessageActions
                          onEdit={() => setEditingId(message.id)}
                          onDelete={() => removeMessage(message.id)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-foreground/10 p-3">
        {errorMessage && <p className="pb-2 text-xs text-destructive">{errorMessage}</p>}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter로 보내고 Shift+Enter로 줄바꿈. 한글 조합 중(Enter로 한자·이모지 확정)에는
              // 보내지 않는다 — isComposing을 안 보면 조합 확정이 전송으로 새어 나간다.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`${partner.name}에 메시지 보내기`}
            aria-label="메시지 입력"
            rows={1}
            className="max-h-32 min-h-9 flex-1 resize-none py-2"
          />
          <Button
            type="button"
            size="icon"
            aria-label="보내기"
            disabled={isSending || draft.trim().length === 0}
            onClick={send}
          >
            <IconSend className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// 말풍선을 입력창으로 바꿔 그 자리에서 고친다.
function EditRow({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);

  return (
    <div className="flex w-full flex-col gap-1">
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (text.trim()) onSave(text.trim());
          }
        }}
        aria-label="메시지 수정"
        rows={2}
        className="min-w-48 resize-none text-sm"
      />
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button type="button" size="sm" disabled={!text.trim()} onClick={() => onSave(text.trim())}>
          저장
        </Button>
      </div>
    </div>
  );
}

function MessageActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirming(false);
      }}
    >
      <PopoverTrigger
        render={
          <Button size="icon-xs" variant="ghost" aria-label="메시지 작업" className="text-muted-foreground">
            <IconDotsVertical />
          </Button>
        }
      />
      <PopoverContent className="w-40 gap-0.5 p-1.5" align="end">
        {confirming ? (
          <>
            <p className="px-2 py-1 text-xs text-muted-foreground">삭제할까요?</p>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              네, 삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              아니요
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                onEdit();
                setOpen(false);
              }}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              삭제
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
