export const PRIORITY_LABEL: Record<string, string> = {
  URGENT: "긴급",
  NORMAL: "보통",
  HOLD: "보류",
};

export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#ef4444",
  NORMAL: "#22c55e",
  HOLD: "transparent",
};

export const STATUS_LABEL: Record<string, string> = {
  TODO: "진행전",
  IN_PROGRESS: "진행중",
  DONE: "완료",
};

// 대시보드 업무 목록의 기본 노출 순서: 진행중 -> 진행전 -> 완료
export const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  DONE: 2,
};

// dueDate는 <input type="date">에서 해당 날짜의 UTC 자정으로 저장된다
// (예: "2026-08-07" -> 2026-08-07T00:00:00Z). 이는 한국시간 기준 그 날짜를
// 의미하므로, "마감을 넘겼다"는 판정은 서버 타임존과 무관하게 한국시간 기준
// 그 날의 23:59:59.999를 기준으로 계산한다.
export const KST_DUE_DAY_END_OFFSET_MS = 53_999_999;

export function isOverdue(dueDate: Date | null, status: string) {
  if (!dueDate || status === "DONE") return false;
  return dueDate.getTime() + KST_DUE_DAY_END_OFFSET_MS < Date.now();
}

export type ParticipantChipData = {
  userId: string;
  userName: string;
  level: string;
  isMaster: boolean;
};

// 참여자 이름칩용 데이터: 우선순위가 없으면 기본값 '보류'. master가 아직 참여자로
// 기록되지 않은 과거 데이터도 항상 첫 칩으로 노출한다.
export function buildParticipantChips(task: {
  masterId: string;
  master: { name: string };
  participants: { userId: string; user: { name: string } }[];
  priorities: { userId: string; level: string }[];
}): ParticipantChipData[] {
  const priorityByUser = new Map(task.priorities.map((p) => [p.userId, p.level]));
  const chips = task.participants.map((p) => ({
    userId: p.userId,
    userName: p.user.name,
    level: priorityByUser.get(p.userId) ?? "HOLD",
    isMaster: p.userId === task.masterId,
  }));
  if (!chips.some((c) => c.userId === task.masterId)) {
    chips.unshift({
      userId: task.masterId,
      userName: task.master.name,
      level: priorityByUser.get(task.masterId) ?? "HOLD",
      isMaster: true,
    });
  }
  return chips;
}
