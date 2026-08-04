import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR_PM",
  description: "프로젝트·업무 관리 툴",
  appleWebApp: {
    title: "AR_PM",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { accentColor: true },
      })
    : null;
  const accentStyle = user?.accentColor
    ? ({ "--primary": user.accentColor, "--ring": user.accentColor } as CSSProperties)
    : undefined;

  return (
    <html lang="ko" className="h-full antialiased" style={accentStyle}>
      <body className={`min-h-full flex flex-col ${session ? "pb-16" : ""}`}>
        {children}
        {session && <BottomNav />}
      </body>
    </html>
  );
}
