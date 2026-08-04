"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateAccentColor(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const reset = formData.get("reset") === "1";
  const raw = (formData.get("accentColor") as string | null)?.trim();

  if (!reset && !HEX_COLOR.test(raw ?? "")) return "올바른 색상 값을 선택하세요.";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { accentColor: reset ? null : raw },
  });

  revalidatePath("/", "layout");
}
