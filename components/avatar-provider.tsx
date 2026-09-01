"use client";

import { createContext, useContext } from "react";

// 프로필 사진이 있는 사용자와 그 사진의 버전(사진이 바뀐 시각)을 앱 전체에 알려 준다.
//
// 참여자 칩(Avatar)은 채팅·파트너 카드·프로젝트 카드 등 화면 곳곳에서 쓰이고, 칩마다
// 넘어오는 데이터 모양도 제각각이라 "이 사람 사진이 있나"를 칩마다 실어 나르기 어렵다.
// 그래서 레이아웃에서 한 번만 읽어 여기에 담아 둔다. 덕분에
//  · 사진 없는 사람에게는 요청 자체를 안 보낸다(예전에는 칩마다 404를 받아 왔다).
//  · 주소에 버전이 붙어 사진을 바꾸면 다른 사람 화면에도 바로 반영된다.
//
// 레이아웃은 화면 이동만으로는 다시 그려지지 않으므로, 남이 방금 올린 사진은 그 사람
// 브라우저에서 새로고침(또는 다음 진입) 때 나타난다.
const AvatarVersionContext = createContext<Record<string, string>>({});

export function AvatarProvider({
  versions,
  children,
}: {
  versions: Record<string, string>;
  children: React.ReactNode;
}) {
  return <AvatarVersionContext value={versions}>{children}</AvatarVersionContext>;
}

// 사진이 없으면 null. 있으면 캐시가 겹치지 않는 이미지 주소.
export function useAvatarSrc(userId: string): string | null {
  const versions = useContext(AvatarVersionContext);
  const version = versions[userId];
  return version ? `/api/avatar/${userId}?v=${version}` : null;
}
