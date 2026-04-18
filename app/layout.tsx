import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Everyday Studio",
  description: "Internal design tool for FRNK Holdings fix-and-flip properties",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased font-sans">
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur shadow-hairline">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Everyday Studio
            </Link>
            {user ? (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">{user.email}</span>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
