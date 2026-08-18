const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// calendar.app.created 범위는 "앱이 만든 캘린더"에만 쓸 수 있다 — 기존 캘린더에는 못 쓴다.
// 그래서 연결 시점에 이 보조 캘린더를 앱이 직접 만들고, 웹앱 업무는 항상 여기로만 내보낸다.
export async function createSyncCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "AR_PM 업무",
      description: "AR_PM 웹앱에서 등록한 업무 일정입니다. 이 캘린더의 일정은 웹앱에서 관리되며, 여기서 직접 수정한 내용은 반영되지 않습니다.",
    }),
  });
  if (!res.ok) throw new Error(`동기화 캘린더 생성 실패: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}
