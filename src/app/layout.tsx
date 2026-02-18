import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import { StoreProvider } from "@/components/providers/StoreProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: "PowerCouple | Data Center Hybrid Siting Platform",
  description:
    "Identify existing U.S. gas plants suitable for co-locating data centers powered by hybrid solar+storage systems with gas backup.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${robotoMono.variable} dark`}
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <StoreProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
