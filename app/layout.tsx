import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { pickForeground } from "@/lib/color";
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
  const accentColor = session?.user?.accentColor;
  const accentStyle = accentColor
    ? ({
        "--primary": accentColor,
        "--ring": accentColor,
        "--primary-foreground": pickForeground(accentColor),
      } as CSSProperties)
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
