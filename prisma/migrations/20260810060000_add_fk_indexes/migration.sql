-- 외래키/정렬 컬럼 인덱스. PostgreSQL은 FK에 인덱스를 자동 생성하지 않아
-- 지금까지 모든 목록 조회가 순차 스캔이었다. 업무가 늘기 전에 깔아둔다.

CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- PK가 (projectId, userId)라 userId 단독 조회는 PK를 쓸 수 없다.
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");
CREATE INDEX "Task_masterId_idx" ON "Task"("masterId");

CREATE INDEX "TaskParticipant_userId_idx" ON "TaskParticipant"("userId");
CREATE INDEX "TaskPriority_userId_idx" ON "TaskPriority"("userId");
CREATE INDEX "TaskRead_userId_idx" ON "TaskRead"("userId");

CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX "SavedFilter_userId_idx" ON "SavedFilter"("userId");

CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
