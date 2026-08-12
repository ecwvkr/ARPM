-- P3: 대시보드 정렬/즐겨찾기용 확장.
-- lastActivityAt: 정렬용. 기존 파트너는 하위 프로젝트의 최신 updatedAt으로 백필하고,
-- 프로젝트가 없으면 파트너 생성 시각을 쓴다.
ALTER TABLE "Partner" ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Partner" p
SET "lastActivityAt" = COALESCE(
    (SELECT MAX(t."updatedAt") FROM "Project" t WHERE t."partnerId" = p.id),
    p."createdAt"
);

-- PartnerPin: 파트너 즐겨찾기(대시보드 상단 고정). 계정별 개인 설정.
CREATE TABLE "PartnerPin" (
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPin_pkey" PRIMARY KEY ("userId", "partnerId")
);

ALTER TABLE "PartnerPin" ADD CONSTRAINT "PartnerPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerPin" ADD CONSTRAINT "PartnerPin_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PartnerPin_partnerId_idx" ON "PartnerPin"("partnerId");
