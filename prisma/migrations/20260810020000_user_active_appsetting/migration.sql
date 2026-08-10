ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "commentVisibleCount" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
