-- 프로필 사진 주소의 캐시 키. 사진이 바뀔 때마다 갱신해 주소를 바꾸면, 다른 사람
-- 브라우저가 캐시한 옛 사진이 그대로 남지 않는다.
ALTER TABLE "User" ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);

-- 이미 사진이 있는 사용자는 지금을 기준 시각으로 잡아 준다.
UPDATE "User" SET "avatarUpdatedAt" = NOW() WHERE "avatarUrl" IS NOT NULL;
