import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Better Media - Next.js Example",
  description: "Example integration of Better Media framework with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
