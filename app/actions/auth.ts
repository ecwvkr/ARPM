"use server";

import { signOut } from "@/auth";

// 로그아웃을 클라이언트 컴포넌트(로고 메뉴)에서 부를 수 있도록 액션으로 뺐다.
// 예전에는 서버 컴포넌트 안의 인라인 액션이라 그 자리에서만 쓸 수 있었다.
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
