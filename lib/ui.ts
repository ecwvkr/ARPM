// 필터·상태·뷰 전환에 공통으로 쓰는 알약 토글 버튼 스타일. Link와 button
// 양쪽에 다 붙일 수 있도록 컴포넌트가 아닌 className 헬퍼로 둔다.
export function chipClass(active: boolean, className = "") {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
  } ${className}`;
}
