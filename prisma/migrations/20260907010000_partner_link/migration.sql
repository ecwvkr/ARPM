-- 파트너 공지 아래에 두는 링크 카드(자주 쓰는 문서·시트 바로가기).

CREATE TABLE "PartnerLink" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PartnerLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerLink_partnerId_createdAt_idx" ON "PartnerLink"("partnerId", "createdAt");
CREATE INDEX "PartnerLink_createdById_idx" ON "PartnerLink"("createdById");

ALTER TABLE "PartnerLink" ADD CONSTRAINT "PartnerLink_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerLink" ADD CONSTRAINT "PartnerLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 새로 만드는 테이블은 RLS가 꺼진 채로 생성된다(20260822010000_enable_rls 참고).
ALTER TABLE "PartnerLink" ENABLE ROW LEVEL SECURITY;
