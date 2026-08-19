import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "イケベジ 進行ボード",
  description: "イケベジのマーケ／システムのタスクと目標を、3人で止めずに回すためのボード",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
