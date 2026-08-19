-- '업무 참여하기' 요청. 파트너 관리자가 수락/거부하며, 거부 이력도 남겨야 하므로
-- 행을 지우지 않고 status만 바꾼다(재신청 시 PENDING으로 되돌림).
CREATE TABLE "PartnerJoinRequest" (
    "partnerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerJoinRequest_pkey" PRIMARY KEY ("partnerId", "userId")
);

CREATE INDEX "PartnerJoinRequest_userId_idx" ON "PartnerJoinRequest"("userId");

ALTER TABLE "PartnerJoinRequest" ADD CONSTRAINT "PartnerJoinRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerJoinRequest" ADD CONSTRAINT "PartnerJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
