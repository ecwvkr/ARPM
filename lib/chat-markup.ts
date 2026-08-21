// 멘션(@)과 태그(/)는 리치 텍스트 에디터를 만들지 않고 평문에 마커로 저장한다.
//   @[홍길동](사용자id)      /[신메뉴_무화과](프로젝트id)
// 저장은 평범한 문자열이라 검색·수정·삭제가 전부 그대로 동작하고, 화면에 그릴 때만
// 마커를 칩으로 바꾼다. contenteditable을 쓰지 않는 이유가 이것이다.

export type ChatTrigger = "@" | "/";

// id는 cuid(영숫자)만 나오므로 좁게 잡는다 — 본문에 우연히 섞인 괄호와 헷갈리지 않게.
const MARKER_PATTERN = /([@/])\[([^\]\n]{1,80})\]\(([A-Za-z0-9_-]{1,40})\)/g;

export type ChatSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; label: string; userId: string }
  | { kind: "tag"; label: string; projectId: string };

export function splitChatMarkup(body: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(MARKER_PATTERN)) {
    const start = match.index;
    if (start > cursor) segments.push({ kind: "text", text: body.slice(cursor, start) });

    const [, trigger, label, id] = match;
    segments.push(
      trigger === "@"
        ? { kind: "mention", label, userId: id }
        : { kind: "tag", label, projectId: id },
    );
    cursor = start + match[0].length;
  }
  if (cursor < body.length) segments.push({ kind: "text", text: body.slice(cursor) });
  return segments;
}

// 입력창 미리보기를 띄울지 판단할 때만 쓴다.
export function hasChatMarker(body: string): boolean {
  return splitChatMarkup(body).some((s) => s.kind !== "text");
}

export function buildMarker(trigger: ChatTrigger, label: string, id: string) {
  // 라벨에 ]가 들어가면 마커가 조기에 닫혀 뒷부분이 본문으로 새므로 미리 지운다.
  return `${trigger}[${label.replace(/[[\]]/g, "")}](${id})`;
}

export function mentionedUserIds(body: string): string[] {
  return [
    ...new Set(
      splitChatMarkup(body)
        .filter((s): s is Extract<ChatSegment, { kind: "mention" }> => s.kind === "mention")
        .map((s) => s.userId),
    ),
  ];
}

// 알림 문구나 목록 미리보기처럼 칩을 그릴 수 없는 자리에서 쓰는 평문 변환.
export function toPlainText(body: string): string {
  return splitChatMarkup(body)
    .map((s) => (s.kind === "text" ? s.text : `${s.kind === "mention" ? "@" : "/"}${s.label}`))
    .join("");
}

export type ActiveToken = { trigger: ChatTrigger; query: string; start: number };

// 커서 왼쪽을 훑어 지금 자동완성을 띄워야 하는지 판단한다. 여기가 이 기능에서
// 제일 까다로운 부분이라 순수 함수로 떼어냈다(scripts/check-chat.ts에서 점검).
const MAX_QUERY = 20;

export function findActiveToken(text: string, caret: number): ActiveToken | null {
  for (let i = caret - 1; i >= 0 && caret - i <= MAX_QUERY + 1; i--) {
    const ch = text[i];
    if (ch === "\n") return null;

    if (ch === "@" || ch === "/") {
      // 단어 첫머리에서만 연다. 이메일(a@b)이나 주소(https://…, 8/21)의 중간 글자는
      // 트리거가 아니다.
      const before = i > 0 ? text[i - 1] : "";
      if (before !== "" && !/\s/.test(before)) return null;
      return { trigger: ch, query: text.slice(i + 1, caret), start: i };
    }
  }
  return null;
}

// 자동완성에서 항목을 고를 때: 토큰 자리를 마커로 갈아끼우고 커서를 그 뒤로 보낸다.
export function replaceToken(
  text: string,
  token: ActiveToken,
  caret: number,
  trigger: ChatTrigger,
  label: string,
  id: string,
): { text: string; caret: number } {
  const marker = `${buildMarker(trigger, label, id)} `;
  const next = text.slice(0, token.start) + marker + text.slice(caret);
  return { text: next, caret: token.start + marker.length };
}
