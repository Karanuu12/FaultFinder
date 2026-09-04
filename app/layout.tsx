import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Timmo — Beautiful Focus Timer, Heatmaps & Leaderboards",
  description:
    "Timmo is a minimalist, premium focus application featuring workspaces, countdowns, activity heatmaps, global leaderboards, and customizable aesthetics.",
  icons: {
    icon: "/icon.webp",
    apple: "/icon.webp",
  },
  openGraph: {
    title: "Timmo — Beautiful Focus Timer, Heatmaps & Leaderboards",
    description:
      "Timmo is a minimalist, premium focus application featuring workspaces, countdowns, activity heatmaps, global leaderboards, and customizable aesthetics.",
    images: ["/og-image.png"],
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
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, inter.variable)}
    >
      <body className="bg-neutral-50 text-neutral-950 font-sans selection:bg-neutral-900 selection:text-white">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}