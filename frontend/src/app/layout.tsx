import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "LifeInk AI",
  description: "个人数据聚合与 AI 对话",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
