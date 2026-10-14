"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { LOGIN_LOCKED_MESSAGE } from "@/lib/login-throttle";
import { signIn } from "@/auth";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "locked") {
      return LOGIN_LOCKED_MESSAGE;
    }
    if (error instanceof AuthError) {
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }
    throw error;
  }
}
