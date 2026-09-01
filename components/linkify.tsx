// 글 안의 http(s) 주소를 눌러서 열 수 있는 링크로 바꾼다. 채팅 말풍선과 프로젝트
// 코멘트가 같이 쓴다.
//
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
    } else if (
      ch === ")" &&
      (url.slice(0, end).match(/\(/g)?.length ?? 0) < (url.slice(0, end).match(/\)/g)?.length ?? 0)
    ) {
      end--;
    } else {
      break;
    }
  }
  return { href: url.slice(0, end), rest: url.slice(end) };
}

// 색은 기본적으로 주변 글에서 물려받는다. 채팅에서 내가 보낸 말풍선은 배경이 진해서,
// 고정 색(text-primary)을 쓰면 배경과 같은 색이 되어 링크가 사라진다(실제로 그랬다).
// 배경이 정해진 곳에서는 linkClassName으로 색을 지정한다.
const DEFAULT_LINK_CLASS = "break-all underline underline-offset-2";

export function linkifyText(
  text: string,
  keyPrefix: string,
  linkClassName = DEFAULT_LINK_CLASS,
): React.ReactNode[] {
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
        className={linkClassName}
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

export function Linkify({ text, linkClassName }: { text: string; linkClassName?: string }) {
  return <>{linkifyText(text, "link", linkClassName)}</>;
}

// 코멘트의 멘션은 채팅과 달리 마커 없이 "@이름" 텍스트로만 저장된다(작성 시 알림 대상은
// 따로 폼에 실린다). 그래서 화면에서는 아는 이름과 대조해 칩으로 그린다 — 이름이 목록에
// 없으면 그냥 글자로 둔다(엉뚱한 "@"까지 칩이 되지 않게).
function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function linkifyWithMentions(
  text: string,
  names: string[],
  { linkClassName, chipClass, meChipClass, myName }: {
    linkClassName?: string;
    chipClass: string;
    meChipClass: string;
    myName?: string;
  },
): React.ReactNode[] {
  if (names.length === 0) return linkifyText(text, "l", linkClassName);

  // 긴 이름을 먼저 시도해야 "이대"가 "이대균"을 가로채지 않는다.
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  // 글 맨 앞이거나 공백 뒤의 "@"만 멘션으로 본다 — 작성기(MENTION_PATTERN)와 같은 규칙이다.
  const pattern = new RegExp(`(^|\\s)@(${alternatives})`, "g");

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length; // 앞 공백은 멘션이 아니다
    if (start > cursor) parts.push(...linkifyText(text.slice(cursor, start), `l${cursor}`, linkClassName));
    const isMe = !!myName && match[2] === myName;
    parts.push(
      <span key={`m${start}`} className={isMe ? meChipClass : chipClass}>
        @{match[2]}
      </span>,
    );
    cursor = start + 1 + match[2].length;
  }
  if (cursor < text.length) parts.push(...linkifyText(text.slice(cursor), `l${cursor}`, linkClassName));
  return parts;
}
