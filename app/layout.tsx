import type { Metadata } from "next";
import Link from "next/link";
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
    <html lang="en">
      <body className="antialiased min-h-screen bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold">
              Everyday Studio
            </Link>
            {user ? (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">{user.email}</span>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
