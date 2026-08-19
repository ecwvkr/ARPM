-- 프로젝트 안 체크리스트(구글 Tasks/애플 미리알림 스타일). 담당자 개념 없이
-- 참여자 누구나 추가·체크·삭제할 수 있는 공유 할 일 목록이다.
-- 모델명이 TaskItem인 이유: D1 리네임(Task→Project) 당시 옛 "Task_pkey" 등 인덱스 이름이
-- Postgres에서 자동으로 안 바뀌고 지금 Project 테이블에 그대로 남아있어, 순수 "Task"로
-- 만들면 그 좀비 인덱스 이름과 충돌한다.
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TaskItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskItem_projectId_createdAt_idx" ON "TaskItem"("projectId", "createdAt");

ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskItem" ADD CONSTRAINT "TaskItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
