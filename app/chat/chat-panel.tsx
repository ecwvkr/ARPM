"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar-stack";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchChatMessages, markChatRead, sendChatMessage } from "@/app/actions/chat";
import type { ChatMessageView, ChatPartner } from "@/lib/chat";
import { MessageBody } from "./message-body";
import { IconSend } from "@tabler/icons-react";

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
}: {
  partner: ChatPartner;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, startSend] = useTransition();

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
  }, [partner.id]);

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
        await markChatRead(partner.id);
        scrollToBottom();
      } catch {
        // 일시적인 실패는 다음 주기에 다시 시도하면 되므로 화면을 건드리지 않는다.
      }
    };

    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [partner.id, scrollToBottom]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-3">
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

        {messages.map((message, i) => {
          const prev = messages[i - 1];
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
                  </div>
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
