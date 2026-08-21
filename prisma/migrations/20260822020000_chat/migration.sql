-- 파트너 단위 채팅(Phase 1). 기존 테이블은 건드리지 않고 추가만 한다 —
-- 이 브랜치의 프리뷰 배포가 프로덕션과 같은 DB를 쓰기 때문이다.

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "replyToId" TEXT,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatMessage_partnerId_createdAt_idx" ON "ChatMessage"("partnerId", "createdAt");
CREATE INDEX "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChatRead" (
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("partnerId","userId")
);

CREATE INDEX "ChatRead_userId_idx" ON "ChatRead"("userId");

ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 20260822010000_enable_rls에서 세운 벽에 구멍이 나지 않도록, 새 테이블도 같이 잠근다.
-- 정책은 만들지 않는다(= 전부 거부). Prisma는 bypassrls 역할로 접속해 영향받지 않는다.
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatRead" ENABLE ROW LEVEL SECURITY;
