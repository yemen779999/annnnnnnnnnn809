import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WebCraft AI Studio — Production Website Cloner & AI Builder",
  description: "Production-grade AI Website Cloner, Prompt-to-Site Builder, and Reverse-Engineering Studio with real-time sandbox, code editor, user accounts, and ZIP export.",
  openGraph: {
    title: "WebCraft AI Studio — Production Website Cloner & AI Builder",
    description: "Production-grade AI Website Cloner, Prompt-to-Site Builder, and Reverse-Engineering Studio with real-time sandbox, code editor, user accounts, and ZIP export.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
