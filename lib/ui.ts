// 필터·상태·뷰 전환에 공통으로 쓰는 알약 토글 버튼 스타일. Link와 button
// 양쪽에 다 붙일 수 있도록 컴포넌트가 아닌 className 헬퍼로 둔다.
export function chipClass(active: boolean, className = "") {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
  } ${className}`;
}

// 다중 선택 필터는 URL에 comma-join된 문자열 하나로 담는다(반복 키 대신) — 서버·클라이언트
// 양쪽에서 같은 방식으로 나눠 읽는다.
export function toArray(v: string | null | undefined): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}
