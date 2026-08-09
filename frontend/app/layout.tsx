import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "./components/Navbar";
import MobileNav from "./components/MobileNav";
import FloatingMascot from "./components/FloatingMascot";
import { Toaster } from "sonner";
import { AuthProvider } from "./lib/AuthContext";
import { LanguageProvider } from "./lib/LanguageContext";
import { MotionProvider } from "./providers/motion-provider";
import { ThemeProvider } from "./providers/theme-provider";

// DESIGN.md §3 — Fraunces: display, variable font with access to all
// axes (opsz/SOFT/WONK), not just static weight — "hand-set old map label"
// character comes from opsz+SOFT+WONK axes (see .font-display in globals.css)
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display",
});

// DESIGN.md §3 — General Sans: body/UI, ONLY 400, 500, 600.
// NOT available on Google Fonts (Fontshare font, free commercial license) —
// self-hosted via next/font/local, same benefits (no layout shift,
// font-display swap, bundled by Next.js).
const generalSans = localFont({
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
});

// DESIGN.md §3 — IBM Plex Mono: numbers (price, date, hash), ONLY 400 & 500
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NusaPath",
  description: "Travel smarter, not harder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="dicoding:email" content="awindya.pswt@gmail.com" />
        <meta name="dicoding:email" content="hibanera.16@gmail.com" />
        <meta name="dicoding:email" content="ghifariakbar2006@gmail.com" />
        <meta name="dicoding:email" content="muhammadabiyyuramadhan01@gmail.com" />

      </head>
      <body className={`${generalSans.variable} ${fraunces.variable} ${ibmPlexMono.variable} font-sans bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark pb-24 transition-colors duration-300`}>
        <MotionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <LanguageProvider>
              <AuthProvider>
                <Navbar />
                {children}
                <MobileNav />
                <Toaster position="top-center" />
                <FloatingMascot />
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
