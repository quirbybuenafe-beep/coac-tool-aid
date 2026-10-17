import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import "./globals.css";

import { getChatGPTUser } from "./chatgpt-auth";
import AdminSidebar from "./admin/admin-sidebar";
import PortalIntro from "./portal-intro";
import { ELECTION_NAME } from "../lib/election";

export const metadata: Metadata = {
  title: ELECTION_NAME,
  description:
    "Meet the JMRSP 2026–2027 Executive Officer candidates, view official records, and cast a secure ballot.",
  icons: {
    icon: "/jmrsp-logo-transparent.png",
    shortcut: "/jmrsp-logo-transparent.png",
    apple: "/jmrsp-logo-transparent.png",
  },
};

export const dynamic = "force-dynamic";

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default async function RootLayout({
  children,
}: RootLayoutProps) {
  const user = await getChatGPTUser();

  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/jmrsp-logo-transparent.png"
          as="image"
        />
      </head>

      <body suppressHydrationWarning>
        <PortalIntro />

        <div
          className="luntian-credit"
          aria-label="Powered by Luntian"
        >
          <span>Powered by</span>
          <strong>Luntian</strong>
        </div>

        {user ? (
          <AdminSidebar user={user}>
            {children}
          </AdminSidebar>
        ) : (
          children
        )}

        <Analytics />
      </body>
    </html>
  );
}
