-- 프로젝트 카드 상단 고정(개인 설정). PartnerPin과 같은 구조.
CREATE TABLE "ProjectPin" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPin_pkey" PRIMARY KEY ("userId","projectId")
);

CREATE INDEX "ProjectPin_projectId_idx" ON "ProjectPin"("projectId");

ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
