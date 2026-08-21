import { Fragment } from "react";
import Link from "next/link";
import { splitChatMarkup } from "@/lib/chat-markup";

// http/https만 링크로 만든다. 화이트리스트가 아니라 "무엇이든 <a href>로 넣는" 방식은
// javascript: 같은 주소가 그대로 실행되는 통로가 된다. 정규식이 프로토콜을 강제하므로
// 여기서 나온 결과는 항상 http(s)다. 문자열을 HTML로 심지 않고 React 엘리먼트로 조립한다.
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

// 문장 끝의 구두점은 주소에서 뺀다("...google.com." 의 마지막 점). 괄호는 짝이 맞을 때만 남긴다.
function trimTrailing(url: string): { href: string; rest: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (".,;:!?".includes(ch)) {
      end--;
    } else if (ch === ")" && (url.slice(0, end).match(/\(/g)?.length ?? 0) < (url.slice(0, end).match(/\)/g)?.length ?? 0)) {
      end--;
    } else {
      break;
    }
  }
  return { href: url.slice(0, end), rest: url.slice(end) };
}

function linkifyText(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    if (start > cursor) parts.push(text.slice(cursor, start));

    const { href, rest } = trimTrailing(match[0]);
    parts.push(
      <a
        key={`${keyPrefix}-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        // 색은 말풍선에서 물려받는다. 내가 보낸 말풍선은 bg-primary라 text-primary를
        // 쓰면 배경과 같은 색이 되어 링크가 사라진다(실제로 그랬다).
        className="break-all underline underline-offset-2"
      >
        {href}
      </a>,
    );
    if (rest) parts.push(rest);
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

// 칩은 말풍선 색을 물려받되 살짝 눌러 구분한다 — 내 말풍선(진한 배경)과 남의
// 말풍선(연한 배경) 양쪽에서 같은 규칙으로 읽히게 하려는 것.
const CHIP_CLASS =
  "rounded-md bg-current/15 px-1 py-0.5 font-medium decoration-current/40 underline-offset-2";

export function MessageBody({
  text,
  partnerId,
  currentUserId,
}: {
  text: string;
  partnerId: string;
  currentUserId: string;
}) {
  const segments = splitChatMarkup(text);

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind === "mention") {
          const isMe = segment.userId === currentUserId;
          return (
            <span
              key={i}
              // 나를 부른 멘션은 더 진하게 — 대화를 훑을 때 내 차례를 먼저 찾게 한다.
              className={`${CHIP_CLASS} ${isMe ? "bg-current/30" : ""}`}
            >
              @{segment.label}
            </span>
          );
        }
        if (segment.kind === "tag") {
          return (
            <Link
              key={i}
              href={`/partners/${partnerId}?project=${segment.projectId}`}
              className={`${CHIP_CLASS} underline`}
            >
              /{segment.label}
            </Link>
          );
        }
        return <Fragment key={i}>{linkifyText(segment.text, String(i))}</Fragment>;
      })}
    </>
  );
}
