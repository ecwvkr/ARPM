"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function listSavedFilters() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return prisma.savedFilter.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveFilter(name: string, query: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!name.trim()) return;

  await prisma.savedFilter.create({
    data: { userId: session.user.id, name: name.trim(), query },
  });
  revalidatePath("/tasks");
}

export async function deleteSavedFilter(id: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await prisma.savedFilter.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/tasks");
}
