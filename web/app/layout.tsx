import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel",
  description: "An agentic workspace for data science experiments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
