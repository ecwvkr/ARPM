import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { pickForeground } from "@/lib/color";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

// 한글 폴백: Inter는 한글 글리프가 없으므로, 없는 글자는 시스템 한글 폰트로 자연히 넘어가도록 지정.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "Noto Sans KR",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});

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
    <html lang="ko" className={cn("h-full antialiased", "font-sans", inter.variable)} style={accentStyle}>
      <body className={`min-h-full flex flex-col ${session ? "pb-16" : ""}`}>
        {children}
        {session && <BottomNav />}
      </body>
    </html>
  );
}
