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
  fetchChatComposerTargets,
  fetchChatMessages,
  markChatRead,
  openChatRoom,
  sendChatMessage,
  toggleChatReaction,
} from "@/app/actions/chat";
import type { ChatMessageView, ChatRoomSummary, ComposerTargets } from "@/lib/chat";
import { findActiveToken, hasChatMarker, replaceToken, toPlainText, type ActiveToken } from "@/lib/chat-markup";
import { MessageBody } from "./message-body";
import { IconSend, IconSearch, IconDotsVertical, IconX, IconMoodPlus, IconCornerUpLeft } from "@tabler/icons-react";

// 패널이 열려 있는 동안에만 짧게 폴링한다. 닫혀 있으면 요청이 아예 나가지 않으므로
// 아무도 대화를 보고 있지 않을 때의 비용이 0이다(무료 플랜의 병목은 호출 수와 CPU 시간).
const POLL_MS = 3000;
// 같은 사람이 이 시간 안에 이어 쓰면 한 덩어리로 묶어 이름과 아바타를 반복하지 않는다.
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const QUICK_EMOJI = ["👍", "✅", "🙏", "👀", "🎉", "😂"];

type SuggestItem = { id: string; label: string; hint?: string; trigger: "@" | "/" };

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
  room,
  currentUserId,
  onRead,
}: {
  room: ChatRoomSummary;
  currentUserId: string;
  onRead: (roomId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [memberCount, setMemberCount] = useState(room.memberCount);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, startSend] = useTransition();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const [targets, setTargets] = useState<ComposerTargets>({ members: [], tags: [] });
  const [token, setToken] = useState<ActiveToken | null>(null);
  const [highlight, setHighlight] = useState(0);
  // 방에 들어온 순간의 읽음 기준. 이 뒤 첫 메시지 위에 '여기까지 읽음'을 긋는다.
  const [markerAt, setMarkerAt] = useState<Date | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 방마다 런처가 key로 이 컴포넌트를 다시 마운트하므로 처음 한 번만 읽으면 된다.
  useEffect(() => {
    let cancelled = false;

    openChatRoom(room.id)
      .then((res) => {
        if (cancelled) return;
        const list = reviveDates(res.messages);
        setMessages(list);
        setHasMore(res.hasMore);
        setMemberCount(res.memberCount);
        setMarkerAt(res.lastReadAt ? new Date(res.lastReadAt) : null);
        latestIdRef.current = list.at(-1)?.id ?? null;
        setErrorMessage(null);
        onRead(room.id);
        // 읽음 처리는 기준값을 받아 화면에 반영한 뒤에 한다. 조회와 같은 호출 안에서
        // 갱신하면 '여기까지 읽음' 기준이 방금 읽은 시각으로 덮여 마커가 사라진다.
        return markChatRead(room.id);
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
  }, [room.id, onRead]);

  // 자동완성 후보도 방을 열 때 한 번만 읽는다. 글자마다 서버를 부르지 않는다.
  useEffect(() => {
    let cancelled = false;
    fetchChatComposerTargets(room.id)
      .then((t) => {
        if (!cancelled) setTargets(t);
      })
      .catch(() => {
        // 후보를 못 읽어도 메시지 작성 자체는 되어야 하므로 조용히 넘어간다.
      });
    return () => {
      cancelled = true;
    };
  }, [room.id]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, scrollToBottom]);

  // 폴링. 탭이 백그라운드면 멈춘다 — 밤새 열어둔 탭이 호출을 태우지 않게.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetchChatMessages(room.id);
        const list = reviveDates(res.messages);
        const newest = list.at(-1)?.id ?? null;
        // 리액션·읽음 표시는 id가 그대로여도 바뀌므로 목록은 항상 갈아끼운다.
        setMessages((prev) => mergeById(prev, list));
        if (newest === latestIdRef.current) return;

        latestIdRef.current = newest;
        onRead(room.id);
        await markChatRead(room.id);
        scrollToBottom();
      } catch {
        // 일시적인 실패는 다음 주기에 다시 시도하면 되므로 화면을 건드리지 않는다.
      }
    };

    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [room.id, scrollToBottom, onRead]);

  function loadOlder() {
    const oldest = messages[0];
    if (!oldest) return;
    fetchChatMessages(room.id, oldest.createdAt.toISOString())
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
        const created = await sendChatMessage(room.id, text, replyTo?.id);
        const [revived] = reviveDates([created]);
        setMessages((prev) => mergeById(prev, [revived]));
        latestIdRef.current = revived.id;
        setDraft("");
        setToken(null);
        setReplyTo(null);
        setErrorMessage(null);
        scrollToBottom();
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "메시지를 보낼 수 없습니다.");
      }
    });
  }

  function syncToken(text: string, caret: number | null) {
    setToken(findActiveToken(text, caret ?? text.length));
    setHighlight(0);
  }

  // 후보는 이미 받아둔 목록을 걸러서 만든다 — 타이핑마다 서버를 부르지 않는다.
  const suggestions: SuggestItem[] = (() => {
    if (!token) return [];
    const q = token.query.trim().toLowerCase();
    const matches = (label: string) => q === "" || label.toLowerCase().includes(q);

    if (token.trigger === "@") {
      return targets.members
        .filter((m) => matches(m.name))
        .slice(0, 6)
        .map((m) => ({ id: m.id, label: m.name, trigger: "@" as const }));
    }
    return targets.tags
      .filter((t) => matches(t.label))
      .slice(0, 6)
      .map((t) => ({
        // 태그는 파트너까지 담아 저장한다 — 1:1·단체방에서도 링크가 살아 있도록.
        id: `${t.partnerId}:${t.projectId}`,
        label: t.label,
        hint: t.kind === "task" ? "태스크" : "프로젝트",
        trigger: "/" as const,
      }));
  })();

  function choose(item: SuggestItem) {
    const input = inputRef.current;
    if (!token || !input) return;

    const next = replaceToken(draft, token, input.selectionStart, item.trigger, item.label, item.id);
    setDraft(next.text);
    setToken(null);
    // 값이 화면에 반영된 뒤에야 커서를 옮길 수 있다.
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
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
          prev.map((m) => (m.id === messageId ? { ...m, deleted: true, body: "", reactions: [] } : m)),
        ),
      )
      .catch((e) => setErrorMessage(e instanceof Error ? e.message : "메시지를 삭제할 수 없습니다."));
  }

  function react(messageId: string, emoji: string) {
    // 응답을 기다리지 않고 먼저 반영한다 — 리액션은 되돌려도 손해가 없는 조작이다.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const found = m.reactions.find((r) => r.emoji === emoji);
        const reactions = found
          ? found.mine
            ? found.count === 1
              ? m.reactions.filter((r) => r.emoji !== emoji)
              : m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r))
            : m.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
          : [...m.reactions, { emoji, count: 1, mine: true }];
        return { ...m, reactions };
      }),
    );
    toggleChatReaction(messageId, emoji).catch(() => setErrorMessage("리액션을 저장하지 못했습니다."));
  }

  // 검색은 이미 불러온 메시지만 훑는다. 방당 메시지가 수백 건 수준이라 서버로 내릴
  // 이유가 없고, 이렇게 하면 타이핑마다 요청이 나가지도 않는다.
  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? messages.filter((m) => !m.deleted && toPlainText(m.body).toLowerCase().includes(keyword))
    : messages;

  // '여기까지 읽음'은 이 방에 들어오기 전 기준보다 나중에 온 남의 첫 메시지 앞에 긋는다.
  const markerId =
    markerAt && !keyword
      ? (messages.find((m) => m.createdAt > markerAt && m.author.id !== currentUserId)?.id ?? null)
      : null;

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
          const isMarker = message.id === markerId;
          const grouped =
            !showDay &&
            !isMarker &&
            !!prev &&
            prev.author.id === message.author.id &&
            message.createdAt.getTime() - prev.createdAt.getTime() < GROUP_WINDOW_MS;
          const mine = message.author.id === currentUserId;
          // 나 말고 몇 명이 더 읽었는지. 1:1은 상대 한 명뿐이라 숫자가 의미 없어
          // '읽음/읽지 않음'으로만 보여준다.
          const unreadBy = Math.max(0, memberCount - 1 - message.readBy);
          const readLabel =
            room.kind === "DIRECT"
              ? unreadBy === 0
                ? "읽음"
                : "읽지 않음"
              : unreadBy === 0
                ? "모두 읽음"
                : `${unreadBy}명 안 읽음`;

          return (
            <div key={message.id}>
              {showDay && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  {formatDay(message.createdAt)}
                </div>
              )}
              {isMarker && (
                <div className="flex items-center gap-2 py-2">
                  <span className="h-px flex-1 bg-destructive/40" />
                  <span className="text-xs font-medium text-destructive">여기까지 읽음</span>
                  <span className="h-px flex-1 bg-destructive/40" />
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
                    <>
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
                          {message.replyTo && !message.deleted && (
                            <span className="mb-1 flex flex-col gap-0.5 rounded-lg bg-current/10 px-2 py-1 text-xs">
                              <span className="font-medium opacity-80">{message.replyTo.authorName}</span>
                              <span className="line-clamp-2 opacity-70">
                                {message.replyTo.body ? toPlainText(message.replyTo.body) : "삭제된 메시지"}
                              </span>
                            </span>
                          )}
                          {message.deleted ? (
                            "삭제된 메시지입니다"
                          ) : (
                            <MessageBody
                              text={message.body}
                              partnerId={room.partnerId}
                              currentUserId={currentUserId}
                            />
                          )}
                        </div>

                        <span className="flex shrink-0 flex-col items-end text-xs whitespace-nowrap text-muted-foreground">
                          {/* 읽은 사람 표시: 아직 안 읽은 사람 수를 보여준다(0이면 모두 읽음). */}
                          {mine && !message.deleted && memberCount > 1 && (
                            <span className={unreadBy === 0 ? "text-primary" : ""}>{readLabel}</span>
                          )}
                          <span>
                            {formatTime(message.createdAt)}
                            {message.editedAt && !message.deleted && " (수정됨)"}
                          </span>
                        </span>

                        {!message.deleted && (
                          <MessageActions
                            canEdit={mine}
                            onReply={() => setReplyTo(message)}
                            onEdit={() => setEditingId(message.id)}
                            onDelete={() => removeMessage(message.id)}
                            onReact={(emoji) => react(message.id, emoji)}
                          />
                        )}
                      </div>

                      {message.reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 ${mine ? "justify-end" : ""}`}>
                          {message.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => react(message.id, r.emoji)}
                              aria-pressed={r.mine}
                              className={`rounded-full border px-1.5 py-0.5 text-xs ${
                                r.mine ? "border-primary bg-primary/10" : "border-foreground/10 bg-muted"
                              }`}
                            >
                              {r.emoji} {r.count}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative shrink-0 border-t border-foreground/10 p-3">
        {errorMessage && <p className="pb-2 text-xs text-destructive">{errorMessage}</p>}

        {suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label={token?.trigger === "@" ? "멤버 자동완성" : "프로젝트 자동완성"}
            className="absolute right-3 bottom-full left-3 mb-1 max-h-56 overflow-y-auto rounded-2xl border border-foreground/10 bg-popover p-1 shadow-lg"
          >
            {suggestions.map((item, i) => (
              <li key={`${item.id}-${item.label}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  // 버튼을 누르면 textarea에서 포커스가 빠져 커서 위치를 잃는다.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    i === highlight ? "bg-muted" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted px-2 py-1.5">
            <IconCornerUpLeft className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs">
              <span className="font-medium">{replyTo.author.name}</span>
              <span className="text-muted-foreground"> · {toPlainText(replyTo.body)}</span>
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="답장 취소"
              onClick={() => setReplyTo(null)}
            >
              <IconX />
            </Button>
          </div>
        )}

        {/* 마커를 평문으로 저장하는 대가로 입력창에는 @[이름](id) 원문이 보인다.
            리치 에디터를 만드는 대신 보낼 모습을 한 줄로 미리 보여준다. */}
        {hasChatMarker(draft) && (
          <p className="pb-2 text-xs break-words text-muted-foreground">
            <span className="mr-1 opacity-70">미리보기</span>
            <MessageBody text={draft} partnerId={room.partnerId} currentUserId={currentUserId} />
          </p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              syncToken(e.target.value, e.target.selectionStart);
            }}
            onClick={(e) => syncToken(draft, e.currentTarget.selectionStart)}
            onBlur={() => setToken(null)}
            onKeyDown={(e) => {
              // 자동완성이 떠 있으면 위/아래로 고르고 Enter·Tab으로 넣는다. 이때
              // Enter가 전송으로 새면 고르려다 메시지가 나가버린다.
              if (suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => (h + 1) % suggestions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setToken(null);
                  return;
                }
                if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  choose(suggestions[highlight]);
                  return;
                }
              }
              // Enter로 보내고 Shift+Enter로 줄바꿈. 한글 조합 중(Enter로 한자·이모지 확정)에는
              // 보내지 않는다 — isComposing을 안 보면 조합 확정이 전송으로 새어 나간다.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`${room.name}에 메시지 보내기 (@멤버, /프로젝트)`}
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

function MessageActions({
  canEdit,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  canEdit: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
}) {
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
      <PopoverContent className="w-44 gap-0.5 p-1.5" align="end">
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
            <div className="flex items-center gap-0.5 px-1 pb-1">
              <IconMoodPlus className="size-3.5 shrink-0 text-muted-foreground" />
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`${emoji} 리액션`}
                  onClick={() => {
                    onReact(emoji);
                    setOpen(false);
                  }}
                  className="rounded-md px-1 py-0.5 text-base hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <hr className="my-1 border-foreground/10" />
            <button
              type="button"
              onClick={() => {
                onReply();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <IconCornerUpLeft className="size-4" />
              답장
            </button>
            {canEdit && (
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
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
