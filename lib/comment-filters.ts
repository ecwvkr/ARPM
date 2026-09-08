// 코멘트 목록의 필터 이름표. 화면 위쪽 버튼(클라이언트)과 목록을 만드는 쪽(서버)이
// 함께 쓴다.
//
// lib/comments.ts에 두면 안 된다 — 거기는 prisma를 들여오므로, 클라이언트 컴포넌트가
// 이 상수를 가져오는 순간 Postgres 드라이버까지 브라우저 번들에 끌려온다(실제로
// "Can't resolve 'dns'" 빌드 오류가 났다). 값만 있는 이 파일은 어느 쪽에서 가져와도 안전하다.

// 한 번에 하나만 고른다 — '전체'가 그중 하나라서 겹쳐 쓸 수 없다.
export type CommentFilter = "all" | "mention" | "authored" | "involved";

export const COMMENT_FILTERS: { key: CommentFilter; label: string }[] = [
  { key: "all", label: "전체 코멘트" },
  { key: "mention", label: "멘션된 코멘트" },
  { key: "authored", label: "내가 작성한 코멘트" },
  { key: "involved", label: "내 프로젝트" },
];

export function toCommentFilter(raw: string | undefined): CommentFilter {
  return COMMENT_FILTERS.some((f) => f.key === raw) ? (raw as CommentFilter) : "all";
}
