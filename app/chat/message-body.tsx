import { Fragment } from "react";

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

export function MessageBody({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    if (start > cursor) parts.push(text.slice(cursor, start));

    const { href, rest } = trimTrailing(match[0]);
    parts.push(
      <a
        key={`${start}-${href}`}
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

  // 줄바꿈은 whitespace-pre-wrap이 처리하므로 여기서는 건드리지 않는다.
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
