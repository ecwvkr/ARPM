-- 채팅을 파트너 고정에서 '방' 구조로 옮긴다. 파트너방 + 1:1 + 단체방.
-- ChatMessage/ChatRead는 이 브랜치에서 만든 테이블이고 운영 코드(master)는 아직
-- 채팅을 모르므로, 기존 테이블을 바꾸는 게 아니라 이 기능 안에서만 바뀌는 변경이다.
-- 이미 쌓인 대화는 파트너방으로 그대로 옮긴다(아래 백필).

CREATE TYPE "ChatRoomKind" AS ENUM ('PARTNER', 'DIRECT', 'GROUP');

CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "kind" "ChatRoomKind" NOT NULL,
    "partnerId" TEXT,
    "name" TEXT,
    "directKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatRoom_partnerId_key" ON "ChatRoom"("partnerId");
CREATE UNIQUE INDEX "ChatRoom_directKey_key" ON "ChatRoom"("directKey");
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChatRoomMember" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("roomId","userId")
);
CREATE INDEX "ChatRoomMember_userId_idx" ON "ChatRoomMember"("userId");
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatReaction" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatReaction_pkey" PRIMARY KEY ("messageId","userId","emoji")
);
CREATE INDEX "ChatReaction_messageId_idx" ON "ChatReaction"("messageId");

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 기존 대화가 있는 파트너마다 파트너방을 만든다(id는 파트너 id를 그대로 재사용해
-- 백필 매핑을 단순하게 유지한다).
INSERT INTO "ChatRoom" ("id", "kind", "partnerId", "createdAt")
SELECT p."id", 'PARTNER', p."id", NOW()
FROM "Partner" p
WHERE p."deletedAt" IS NULL;

-- ChatMessage: partnerId -> roomId
ALTER TABLE "ChatMessage" ADD COLUMN "roomId" TEXT;
UPDATE "ChatMessage" SET "roomId" = "partnerId";
DELETE FROM "ChatMessage" WHERE "roomId" IS NULL;
ALTER TABLE "ChatMessage" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_partnerId_fkey";
DROP INDEX "ChatMessage_partnerId_createdAt_idx";
ALTER TABLE "ChatMessage" DROP COLUMN "partnerId";
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReaction" ADD CONSTRAINT "ChatReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ChatRead: partnerId -> roomId (복합 PK라 새로 만든다)
ALTER TABLE "ChatRead" ADD COLUMN "roomId" TEXT;
UPDATE "ChatRead" SET "roomId" = "partnerId";
DELETE FROM "ChatRead" WHERE "roomId" IS NULL;
ALTER TABLE "ChatRead" ALTER COLUMN "roomId" SET NOT NULL;
ALTER TABLE "ChatRead" DROP CONSTRAINT "ChatRead_pkey";
ALTER TABLE "ChatRead" DROP CONSTRAINT "ChatRead_partnerId_fkey";
ALTER TABLE "ChatRead" DROP COLUMN "partnerId";
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("roomId","userId");
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 새 테이블도 잠근다(20260822010000_enable_rls와 같은 이유).
ALTER TABLE "ChatRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatRoomMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
