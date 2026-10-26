import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

import { fullLibraryName } from "@/lib/branding";

/** Editorial serif for display type, grotesque for UI copy. */
const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--app-display",
});

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--app-sans",
});

export const metadata: Metadata = {
  title: `${fullLibraryName} | Find your next good read`,
  description: `Explore the ${fullLibraryName} collection, find exact shelf locations, and reserve books online.`,
};

/**
 * Runs before first paint so the saved theme is applied with no flash of the
 * wrong colours. Falls back to the operating-system preference.
 */
const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("college_library_theme");
    var dark = saved ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
