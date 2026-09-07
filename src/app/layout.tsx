import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "class-attend",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
