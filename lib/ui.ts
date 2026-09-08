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

// "2026. 9. 8. 오후 4:46" 꼴로 시각을 적는다.
//
// toLocaleString("ko-KR")을 그냥 쓰면 안 된다. 오전/오후 같은 말은 그 환경의 로케일
// 자료에서 오는데, 서버(Node)와 브라우저가 서로 다른 자료를 들고 있으면 "오후"와 "PM"으로
// 갈린다. 클라이언트에서 찍으면 하이드레이션이 깨지고, 서버에서 찍어도 개발기와 운영기가
// 다르게 나온다(둘 다 실제로 겪었다).
//
// 그래서 숫자만 로케일과 무관한 방식으로 뽑고, 한국어 표기는 여기서 직접 붙인다.
// 시간대는 서버가 UTC로 돌아도 한국 시각이 나오도록 못박는다.
const STAMP_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function koreanStamp(date: Date): string {
  const parts = Object.fromEntries(
    STAMP_PARTS.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  // hour12:false는 자정을 "24"로 주는 환경이 있다 — 24시는 0시로 되돌린다.
  const hour24 = Number(parts.hour) % 24;
  const meridiem = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 || 12;

  return `${parts.year}. ${Number(parts.month)}. ${Number(parts.day)}. ${meridiem} ${hour12}:${parts.minute}`;
}
