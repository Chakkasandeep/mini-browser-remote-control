import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini Browser Remote Control",
  description: "Local remote control for Chromium running in Docker"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
