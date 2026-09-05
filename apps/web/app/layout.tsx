import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FaultFinder — RAG Machine Troubleshooting System",
  description:
    "FaultFinder is an intelligent RAG troubleshooting assistant — type an error code, symptom, or machine name and get a precise, cited answer from the correct manual.",
  icons: {
    icon: "/icon.webp",
    apple: "/icon.webp",
  },
  openGraph: {
    title: "FaultFinder — RAG Machine Troubleshooting System",
    description:
      "FaultFinder is an intelligent RAG troubleshooting assistant — type an error code, symptom, or machine name and get a precise, cited answer from the correct manual.",
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
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}