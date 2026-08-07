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

export function isOverdue(dueDate: Date | null, status: string) {
  return !!dueDate && dueDate < new Date() && status !== "DONE";
}

export type ParticipantChipData = {
  userId: string;
  userName: string;
  level: string;
  isMaster: boolean;
};

// 참여자 이름칩용 데이터: 우선순위가 없으면 기본값 '보통'. master가 아직 참여자로
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
    level: priorityByUser.get(p.userId) ?? "NORMAL",
    isMaster: p.userId === task.masterId,
  }));
  if (!chips.some((c) => c.userId === task.masterId)) {
    chips.unshift({
      userId: task.masterId,
      userName: task.master.name,
      level: priorityByUser.get(task.masterId) ?? "NORMAL",
      isMaster: true,
    });
  }
  return chips;
}
