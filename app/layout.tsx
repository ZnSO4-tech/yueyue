import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "月月上岸计划｜教师资格证闯关复习",
  description: "为月月制作的教师资格证科目二与初中地理趣味闯关复习网站。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
